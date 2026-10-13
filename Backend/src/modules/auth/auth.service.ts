import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { config } from '../../config/env';
import { EmailService } from '../../services/email.service';
import { enqueueVerificationEmail } from '../../queues/email.queue';
import { generateSecureVerificationCode } from '../../utils/crypto.util';
import { RegisterInput, LoginInput } from './auth.validation';

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    emailVerifiedAt: Date | null;
  };
  token: string;
}

export class AuthService {
  /**
   * Bcrypt adaptive cost factor (salt rounds).
   * Enforced to be >= 10 (default: 12, representing 2^12 = 4,096 iterations)
   * in accordance with OWASP security guidelines for slow, adaptive password hashing.
   */
  private static readonly SALT_ROUNDS = config.bcryptSaltRounds;
  private static readonly TOKEN_EXPIRY = '7d';

  static async register(input: RegisterInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    // Generate cryptographically secure one-time verification token (24-hour expiration)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    // Generate cryptographically secure 6-digit verification code using crypto.randomBytes and rejection sampling
    const verificationCode = generateSecureVerificationCode(6);
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
        verificationToken,
        verificationCode,
        verificationTokenExpiresAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });

    // Enqueue background job to send verification email with 6-digit code via BullMQ
    enqueueVerificationEmail({
      email: user.email,
      name: user.name,
      token: verificationToken,
      code: verificationCode,
    }).catch(() => {});

    const token = this.generateToken(user.id, user.email);

    return { user, token };
  }

  /**
   * Verifies an email using the one-time verification token.
   * Atomically invalidates the token and code so they cannot be reused.
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; message: string; email: string }> {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid verification token.');
    }

    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new Error('Invalid or already used verification link.');
    }

    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new Error('This verification link has expired. Please request a new one.');
    }

    // Atomically mark verified and clear both token and code to ensure strictly ONE-TIME usage
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationCode: null,
        verificationTokenExpiresAt: null,
      },
    });

    return {
      success: true,
      message: 'Email address successfully verified! Your Rota account is active.',
      email: user.email,
    };
  }

  /**
   * Verifies an email using the 6-digit verification code.
   * Atomically invalidates the code and link upon success.
   */
  static async verifyCode(email: string, code: string): Promise<{ success: boolean; message: string; email: string }> {
    if (!email || !code) {
      throw new Error('Email address and verification code are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.verificationCode) {
      throw new Error('Invalid or already used verification code.');
    }

    if (user.verificationCode !== code.trim()) {
      throw new Error('Incorrect verification code. Please check your email and try again.');
    }

    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new Error('This verification code has expired. Please request a new one.');
    }

    // Atomically mark verified and clear code and token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationCode: null,
        verificationTokenExpiresAt: null,
      },
    });

    return {
      success: true,
      message: 'Email address successfully verified! Your Rota account is active.',
      email: user.email,
    };
  }

  /**
   * Resends a fresh one-time verification email link and 6-digit code.
   */
  static async resendVerification(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Safe generic message to prevent user enumeration
      return { message: 'If an account exists with this email, a verification link has been sent.' };
    }

    if (user.emailVerifiedAt) {
      return { message: 'This account has already been verified.' };
    }

    // Generate fresh one-time token and code with renewed 24-hour expiration
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = generateSecureVerificationCode(6);
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationCode,
        verificationTokenExpiresAt,
      },
    });

    await enqueueVerificationEmail({
      email: user.email,
      name: user.name,
      token: verificationToken,
      code: verificationCode,
    });

    return { message: 'A new one-time verification link and code have been sent to your email.' };
  }

  static async login(input: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password.');
    }

    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      token,
    };
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    return user;
  }

  private static generateToken(userId: string, email: string): string {
    return jwt.sign(
      { sub: userId, email },
      config.jwtSecret,
      { expiresIn: this.TOKEN_EXPIRY }
    );
  }
}
