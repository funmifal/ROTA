import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { config } from '../../config/env';
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
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
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

    const token = this.generateToken(user.id, user.email);

    return { user, token };
  }

  static async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
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
