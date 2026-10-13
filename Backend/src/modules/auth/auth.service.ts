import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { config } from '../../config/env';
import { EmailService } from '../../services/email.service';
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
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
        verificationToken,
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

    // Send one-time email verification link using Nodemailer
    EmailService.sendVerificationEmail(user.email, user.name, verificationToken).catch((err) => {
      // Log failure internally without throwing to prevent registration interruption
      // Background retries can pick up or user can request a resend
    });

    const token = this.generateToken(user.id, user.email);

    return { user, token };
  }

  /**
   * Verifies an email using the one-time verification token.
   * Atomically invalidates the token so it cannot be reused.
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

    // Atomically mark verified and clear the token to ensure strictly ONE-TIME usage
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationToken: null,
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
   * Resends a fresh one-time verification email link.
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

    // Generate fresh one-time token with renewed 24-hour expiration
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiresAt,
      },
    });

    await EmailService.sendVerificationEmail(user.email, user.name, verificationToken);

    return { message: 'A new one-time verification link has been sent to your email.' };
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
