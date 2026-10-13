import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { config } from '../../config/env';
import { EmailService } from '../../services/email.service';
import { enqueueVerificationEmail } from '../../queues/email.queue';
import { generateSecureVerificationCode } from '../../utils/crypto.util';
import { RegisterInput, LoginInput } from './auth.validation';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds (e.g. 900 for 15m)
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    emailVerifiedAt: Date | null;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** Legacy token field for backward compatibility */
  token: string;
}

export class AuthService {
  private static readonly SALT_ROUNDS = config.bcryptSaltRounds;
  /** Short-lived access token: 15 minutes */
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;
  /** Long-lived refresh token: 30 days */
  private static readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;

  /**
   * Generates a short-lived access token and a rotating refresh token,
   * grouped by a familyId to detect token theft/reuse.
   */
  private static async generateTokenPair(
    userId: string,
    email: string,
    tokenVersion: number,
    existingFamilyId?: string
  ): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: userId, email, tokenVersion },
      config.jwtSecret,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const familyId = existingFamilyId || crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    await prisma.refreshToken.create({
      data: {
        token: rawRefreshToken,
        userId,
        familyId,
        expiresAt,
        isRevoked: false,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

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
        tokenVersion: true,
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

    // Generate short-lived access token and rotating refresh token
    const tokens = await this.generateTokenPair(user.id, user.email, user.tokenVersion);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      token: tokens.accessToken,
    };
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

    // Generate short-lived access token and rotating refresh token
    const tokens = await this.generateTokenPair(user.id, user.email, user.tokenVersion);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      token: tokens.accessToken,
    };
  }

  /**
   * Refreshes an access token using a rotating refresh token.
   * STRICT REUSE DETECTION (RFC 6749 / OAuth 2.0 Security BCP):
   * If an already-used or revoked refresh token is presented, this signals that
   * the token has been stolen! Immediately invalidates all tokens in the family.
   */
  static async refreshTokens(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new Error('Refresh token is required.');
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    // CASE 1: Token reuse detected (stolen token indicator)
    if (tokenRecord && (tokenRecord.isRevoked || tokenRecord.usedAt !== null)) {
      console.warn(`[SECURITY ALERT] Refresh token reuse detected for user ${tokenRecord.userId}, family ${tokenRecord.familyId}`);
      
      // Revoke the ENTIRE token family and increment tokenVersion to revoke all access tokens
      await prisma.$transaction([
        prisma.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: { isRevoked: true },
        }),
        prisma.user.update({
          where: { id: tokenRecord.userId },
          data: { tokenVersion: { increment: 1 } },
        }),
        prisma.auditLog.create({
          data: {
            businessId: null,
            userId: tokenRecord.userId,
            action: 'SUSPICIOUS_TOKEN_REUSE_DETECTED',
            resource: 'RefreshToken',
            resourceId: tokenRecord.id,
            metadata: { familyId: tokenRecord.familyId },
          },
        }),
      ]);

      throw new Error('Refresh token reuse detected. All sessions in this chain have been terminated for security. Please log in again.');
    }

    // CASE 2: Invalid or expired token
    if (!tokenRecord) {
      throw new Error('Invalid refresh token. Please log in again.');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });
      throw new Error('Refresh token has expired. Please log in again.');
    }

    // CASE 3: Valid token -> Rotate token (mark old as used, issue new in same family)
    const user = tokenRecord.user;
    
    // Invalidate old token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        usedAt: new Date(),
        isRevoked: true,
      },
    });

    // Issue new pair in the same token family
    return this.generateTokenPair(user.id, user.email, user.tokenVersion, tokenRecord.familyId);
  }

  /**
   * Single-device logout: Revokes the specified refresh token.
   */
  static async logout(refreshToken?: string): Promise<{ message: string }> {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { isRevoked: true, usedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully.' };
  }

  /**
   * Log out of all devices:
   * 1. Revokes all active refresh tokens for the user.
   * 2. Increments user tokenVersion to immediately invalidate all active access tokens.
   */
  static async logoutAll(userId: string): Promise<{ message: string }> {
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: {
          businessId: null,
          userId,
          action: 'LOGOUT_ALL_DEVICES',
          resource: 'User',
          resourceId: userId,
        },
      }),
    ]);

    return { message: 'Successfully logged out of all devices.' };
  }

  /**
   * Requests a passwordless magic login link sent via email.
   */
  static async requestMagicLink(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate previous magic link tokens for this email
    await prisma.magicLinkToken.deleteMany({
      where: { email: normalizedEmail },
    });

    await prisma.magicLinkToken.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
      },
    });

    // Send magic login email
    await EmailService.sendMagicLinkEmail(normalizedEmail, token);

    return { message: 'A magic login link has been sent to your email.' };
  }

  /**
   * Verifies a magic login link token.
   * Creates an account if none exists, or authenticates the existing user.
   */
  static async verifyMagicLink(token: string): Promise<AuthResponse> {
    if (!token) throw new Error('Magic link token is required.');

    const record = await prisma.magicLinkToken.findUnique({
      where: { token },
    });

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new Error('This magic login link is invalid or has expired. Please request a new one.');
    }

    // Mark single-use token as used
    await prisma.magicLinkToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: record.email },
    });

    if (!user) {
      const defaultName = record.email.split('@')[0];
      const placeholderHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), this.SALT_ROUNDS);
      user = await prisma.user.create({
        data: {
          name: defaultName,
          email: record.email,
          passwordHash: placeholderHash,
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.emailVerifiedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    const tokens = await this.generateTokenPair(user.id, user.email, user.tokenVersion);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      token: tokens.accessToken,
    };
  }

  /**
   * Requests a password reset email with a single-use expiring token.
   */
  static async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Avoid account enumeration: always return safe generic response
    if (!user) {
      return { message: 'If an account exists with this email, a password reset link has been sent.' };
    }

    // Invalidate any previous unused reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    await EmailService.sendPasswordResetEmail(user.email, user.name, token);

    return { message: 'If an account exists with this email, a password reset link has been sent.' };
  }

  /**
   * Resets the user's password using a single-use token.
   * Invalidates all existing sessions (log out of all devices) on password change.
   */
  static async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!token || !newPassword) {
      throw new Error('Token and new password are required.');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt !== null) {
      throw new Error('Invalid or already used password reset link. Please request a new one.');
    }

    if (resetRecord.expiresAt < new Date()) {
      throw new Error('This password reset link has expired. Please request a new one.');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await prisma.$transaction([
      // Update password and increment tokenVersion (invalidates all access tokens)
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 },
        },
      }),
      // Mark reset token as used
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all existing refresh tokens
      prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId, isRevoked: false },
        data: { isRevoked: true, usedAt: new Date() },
      }),
      // Audit log
      prisma.auditLog.create({
        data: {
          businessId: null,
          userId: resetRecord.userId,
          action: 'PASSWORD_RESET',
          resource: 'User',
          resourceId: resetRecord.userId,
        },
      }),
    ]);

    return { message: 'Your password has been successfully reset. Please log in with your new password.' };
  }

  static async verifyEmail(token: string): Promise<{ success: boolean; message: string; email: string }> {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid verification token.');
    }

    const verificationRecord = await prisma.emailVerified.findFirst({
      where: { token },
    });

    if (!verificationRecord) {
      throw new Error('Invalid or already used verification link. Please request a new one.');
    }

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

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
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

    const verificationRecord = await prisma.emailVerified.findUnique({
      where: { email: normalizedEmail },
    });

    if (!verificationRecord) {
      throw new Error('Invalid or already used verification code. Please request a new one.');
    }

    if (verificationRecord.expiresAt < new Date()) {
      await prisma.emailVerified.delete({ where: { id: verificationRecord.id } }).catch(() => {});
      throw new Error('This verification code has expired. Please request a new one.');
    }

    if (verificationRecord.code !== code.trim()) {
      throw new Error('Incorrect verification code. Please check your email and try again.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
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

  static async resendVerification(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { message: 'If an account exists with this email, a verification link has been sent.' };
    }

    if (user.emailVerifiedAt) {
      return { message: 'This account has already been verified.' };
    }

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
}
