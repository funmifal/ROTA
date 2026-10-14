import Redis from 'ioredis';
import { config } from '../config/env';

/**
 * ============================================================================
 * Task A: Redis Cache Service for Rosters, Shifts, and Feeds with Invalidation
 * ============================================================================
 * 
 * Provides:
 * 1. Redis caching with TTL.
 * 2. In-memory fallback map when local Redis is offline.
 * 3. Pattern-based invalidation for tenant mutations (e.g., when shifts change).
 * ============================================================================
 */

interface MemoryCacheEntry {
  data: any;
  expiresAt: number;
}

class CacheServiceImpl {
  private redis: Redis | null = null;
  private isRedisReady = false;
  private memoryCache = new Map<string, MemoryCacheEntry>();

  constructor() {
    this.initRedis();
  }

  private initRedis(): void {
    try {
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 1000, 3000);
        },
      });

      this.redis.on('ready', () => {
        this.isRedisReady = true;
      });

      this.redis.on('error', () => {
        this.isRedisReady = false;
      });

      this.redis.on('close', () => {
        this.isRedisReady = false;
      });
    } catch {
      this.isRedisReady = false;
    }
  }

  /**
   * Retrieves a parsed JSON value from cache, or null if miss/expired.
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisReady && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw) return JSON.parse(raw) as T;
      } catch {
        // Fall back to in-memory
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Stores a value in cache with a TTL (default: 300 seconds / 5 minutes).
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch {
        // Fall back to in-memory
      }
    }

    this.memoryCache.set(key, {
      data: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Deletes a specific key from cache.
   */
  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);
    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Invalidates all keys matching a prefix or pattern.
   * e.g., `cache:business:${businessId}:shifts:*`
   */
  async invalidatePattern(prefixOrPattern: string): Promise<number> {
    let deletedCount = 0;

    // Invalidate in memory
    const cleanPrefix = prefixOrPattern.replace(/\*$/, '');
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(cleanPrefix)) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }

    // Invalidate in Redis
    if (this.isRedisReady && this.redis) {
      try {
        const pattern = prefixOrPattern.endsWith('*') ? prefixOrPattern : `${prefixOrPattern}*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          deletedCount += keys.length;
        }
      } catch {
        // Ignore
      }
    }

    return deletedCount;
  }

  /**
   * High-level cache helper: returns cached value or executes fetcher, caches result, and returns.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
  ): Promise<{ data: T; cached: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return { data: cached, cached: true };
    }

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return { data: fresh, cached: false };
  }

  /**
   * Clears the entire cache (useful in tests).
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.flushdb();
      } catch {
        // Ignore
      }
    }
  }
}

export const CacheService = new CacheServiceImpl();
