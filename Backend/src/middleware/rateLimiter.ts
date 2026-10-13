import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config/env';

let redisClient: Redis | null = null;
let isRedisReady = false;

// Fallback in-memory store if Redis is temporarily unreachable
interface MemoryEntry {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, MemoryEntry>();

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
      lazyConnect: false,
    });

    redisClient.on('ready', () => {
      isRedisReady = true;
      console.log('[RateLimiter] Connected to Redis successfully.');
    });

    redisClient.on('error', (err) => {
      isRedisReady = false;
      // Suppress spammy connection errors if Redis isn't running locally
    });

    redisClient.on('close', () => {
      isRedisReady = false;
    });
  }
  return redisClient;
}

// Initialize connection attempt
try {
  getRedisClient();
} catch (e) {
  // Graceful initialization
}

export interface RateLimiterOptions {
  prefix: string;
  windowMs: number; // e.g. 15 * 60 * 1000 (15 minutes)
  max: number; // max requests within window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Creates an Express rate-limiting middleware backed by Redis,
 * with graceful in-memory fallback.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    prefix,
    windowMs,
    max,
    message = 'Too many requests. Please try again later.',
    keyGenerator,
  } = options;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientIp = (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1'
      ).trim();

      const customKey = keyGenerator ? keyGenerator(req) : clientIp;
      const key = `rl:${prefix}:${customKey}`;

      if (isRedisReady && redisClient) {
        try {
          const current = await redisClient.incr(key);
          if (current === 1) {
            await redisClient.expire(key, windowSeconds);
          }
          const ttl = await redisClient.ttl(key);

          res.setHeader('X-RateLimit-Limit', max);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
          res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds));

          if (current > max) {
            const retryAfter = ttl > 0 ? ttl : windowSeconds;
            res.setHeader('Retry-After', retryAfter);
            res.status(429).json({
              error: 'TooManyRequests',
              message,
              retryAfterSeconds: retryAfter,
            });
            return;
          }

          next();
          return;
        } catch (redisErr) {
          // Redis operation failed; fall through to in-memory store
        }
      }

      // In-memory fallback
      const now = Date.now();
      let record = memoryStore.get(key);

      if (!record || record.resetAt <= now) {
        record = { count: 1, resetAt: now + windowMs };
        memoryStore.set(key, record);
      } else {
        record.count += 1;
      }

      const ttlSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      if (record.count > max) {
        res.setHeader('Retry-After', ttlSeconds);
        res.status(429).json({
          error: 'TooManyRequests',
          message,
          retryAfterSeconds: ttlSeconds,
        });
        return;
      }

      next();
    } catch (err: any) {
      // Fail safely to avoid blocking valid traffic on unexpected system errors
      next();
    }
  };
}

/**
 * Login rate limiter: 5 requests per 15 minutes per IP/email
 */
export const loginRateLimiter = createRateLimiter({
  prefix: 'login',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip';
    return email ? `${ip}:${email}` : String(ip);
  },
});

/**
 * Password reset rate limiter: 3 requests per 15 minutes
 */
export const passwordResetRateLimiter = createRateLimiter({
  prefix: 'password-reset',
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many password reset requests. Please wait before trying again.',
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip';
    return email ? `${ip}:${email}` : String(ip);
  },
});

/**
 * Invitations rate limiter: 10 invitations per 1 hour per business/IP
 */
export const inviteRateLimiter = createRateLimiter({
  prefix: 'invites',
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Invitation limit reached. Please wait before sending more invitations.',
  keyGenerator: (req) => {
    const businessId = req.params?.businessId || req.body?.businessId || 'business';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip';
    return `${businessId}:${ip}`;
  },
});

/**
 * Payment/Checkout rate limiter: 5 checkout initiations per 15 minutes
 */
export const paymentRateLimiter = createRateLimiter({
  prefix: 'payment',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many payment requests. Please wait a few moments before trying again.',
  keyGenerator: (req) => {
    const businessId = req.params?.businessId || 'business';
    const userId = req.user?.id || req.socket.remoteAddress || 'user';
    return `${businessId}:${userId}`;
  },
});
