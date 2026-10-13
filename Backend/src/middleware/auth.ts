import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../database/prisma';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      email: string;
      tokenVersion?: number;
    };

    // If token has a tokenVersion, check against database to enforce "logout all" and password reset revocation
    if (payload.tokenVersion !== undefined) {
      const userRecord = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true },
      });

      if (!userRecord || userRecord.tokenVersion !== payload.tokenVersion) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Session has been revoked. Please log in again.',
        });
        return;
      }
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token.',
    });
  }
}
