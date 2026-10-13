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

  /**
   * Helper to generate and store temporary email verification details in the EmailVerified table.
   * Details are valid for the configured period (default 15 minutes).
   */
  private static async createTemporaryVerification(email: string): Promise<{ token: string; code: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString('hex');
    const code = generateSecureVerificationCode(6);
    const expiresAt = new Date(Date.now() + config.verificationCodeExpiryMinutes * 60 * 1000);

    await prisma.emailVerified.upsert({
      where: { email },
      create: {
        email,
        code,
        token,
        expiresAt,
      },
      update: {
        code,
        token,
        expiresAt,
      },
    });

    return { token, code, expiresAt };
  }

  static async register(input: RegisterInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });

    // Generate verification details and store temporarily in the EmailVerified table
    const { token: verificationToken, code: verificationCode } =
      await this.createTemporaryVerification(user.email);

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
   * Atomically invalidates and deletes the temporary EmailVerified record upon success.
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; message: string; email: string }> {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid verification token.');
    }

    // Lookup temporary record in EmailVerified table
    const verificationRecord = await prisma.emailVerified.findFirst({
      where: { token },
    });

    if (!verificationRecord) {
      throw new Error('Invalid or already used verification link. Please request a new one.');
    }

    // Check code/token expiration period
    if (verificationRecord.expiresAt < new Date()) {
      await prisma.emailVerified.delete({ where: { id: verificationRecord.id } }).catch(() => {});
      throw new Error('This verification link has expired. Please request a new one.');
    }

    const user = await prisma.user.findUnique({
      where: { email: verificationRecord.email },
    });

    if (!user) {
      throw new Error('User account not found for this verification link.');
    }

    // Atomically mark user verified and delete temporary record from EmailVerified table
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
        },
      });

      await tx.emailVerified.deleteMany({
        where: { email: verificationRecord.email },
      });
    });

    return {
      success: true,
      message: 'Email address successfully verified! Your Rota account is active.',
      email: user.email,
    };
  }

  /**
   * Verifies an email using the 6-digit verification code.
   * Checks expiration period and deletes the temporary record from EmailVerified upon success.
   */
  static async verifyCode(email: string, code: string): Promise<{ success: boolean; message: string; email: string }> {
    if (!email || !code) {
      throw new Error('Email address and verification code are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new Error('Invalid email address.');
    }

    if (user.emailVerifiedAt) {
      return {
        success: true,
        message: 'Email address has already been verified.',
        email: user.email,
      };
    }

    // Lookup temporary record in EmailVerified table
    const verificationRecord = await prisma.emailVerified.findUnique({
      where: { email: normalizedEmail },
    });

    if (!verificationRecord) {
      throw new Error('Invalid or already used verification code. Please request a new one.');
    }

    // Check expiration period
    if (verificationRecord.expiresAt < new Date()) {
      // Clean up expired temporary record
      await prisma.emailVerified.delete({ where: { id: verificationRecord.id } }).catch(() => {});
      throw new Error('This verification code has expired. Please request a new one.');
    }

    if (verificationRecord.code !== code.trim()) {
      throw new Error('Incorrect verification code. Please check your email and try again.');
    }

    // Atomically mark verified and delete temporary record from EmailVerified table
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
        },
      });

      await tx.emailVerified.deleteMany({
        where: { email: normalizedEmail },
      });
    });

    return {
      success: true,
      message: 'Email address successfully verified! Your Rota account is active.',
      email: user.email,
    };
  }

  /**
   * Resends a fresh one-time verification email link and 6-digit code.
   * Generates and updates temporary details in the EmailVerified table.
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

    // Generate fresh temporary verification details stored in EmailVerified table
    const { token: verificationToken, code: verificationCode } =
      await this.createTemporaryVerification(user.email);

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
