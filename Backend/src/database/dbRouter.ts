import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { prisma as primaryPrisma } from './prisma';

/**
 * ============================================================================
 * Task A: Read and Write Database Routing with Read-Your-Own-Writes Consistency
 * ============================================================================
 * 
 * Problem:
 * In a master-replica database architecture, write traffic goes to the Primary (Writer)
 * and read traffic goes to one or more Read Replicas. Due to asynchronous replication,
 * replicas often lag behind the primary by 10ms - 500ms.
 * 
 * If a user creates a shift or accepts a swap and immediately refreshes their feed,
 * routing that read to a lagging replica causes "phantom reads" (the user's own write
 * appears to have disappeared), destroying trust.
 * 
 * Solution:
 * "Read-Your-Own-Writes" Consistency:
 * 1. Primary DB handles all write operations (INSERT, UPDATE, DELETE).
 * 2. Whenever a user performs a write, we track their `lastWriteTimestamp`.
 * 3. Any read request from that user within `REPLICATION_LAG_WINDOW_MS` (5 seconds)
 *    is deterministically pinned to the Primary database.
 * 4. Once the replication window has elapsed, reads safely route to the Read Replica.
 * ============================================================================
 */

export const REPLICATION_LAG_WINDOW_MS = 5000; // 5 seconds grace period for replication

// Optional separate Read Replica client (falls back to Primary if replica URL is not configured)
const replicaDatabaseUrl = process.env.DATABASE_REPLICA_URL || process.env.DATABASE_URL;

export const replicaPrisma = new PrismaClient({
  datasources: {
    db: {
      url: replicaDatabaseUrl,
    },
  },
  log: ['error'],
});

// In-memory watermark map (or backed by Redis in clustered deployments)
const userLastWriteTimestamps = new Map<string, number>();

export class DatabaseRouter {
  /**
   * Records that a user has just performed a write operation.
   */
  static recordUserWrite(userId: string): void {
    userLastWriteTimestamps.set(userId, Date.now());
  }

  /**
   * Determines whether a read query from this user must be routed to the Primary DB
   * to guarantee Read-Your-Own-Writes consistency.
   */
  static shouldReadFromPrimary(userId?: string): boolean {
    if (!userId) return false;
    const lastWrite = userLastWriteTimestamps.get(userId);
    if (!lastWrite) return false;

    const elapsed = Date.now() - lastWrite;
    return elapsed < REPLICATION_LAG_WINDOW_MS;
  }

  /**
   * Returns the appropriate Prisma client for a read operation.
   * If the user wrote recently within REPLICATION_LAG_WINDOW_MS, returns Primary.
   * Otherwise, returns Replica.
   */
  static getReadClient(userId?: string): PrismaClient {
    if (this.shouldReadFromPrimary(userId)) {
      return primaryPrisma;
    }
    return replicaPrisma;
  }

  /**
   * Always returns the Primary Prisma client for write mutations.
   */
  static getWriteClient(): PrismaClient {
    return primaryPrisma;
  }

  /**
   * Helper for tests to inspect routing decisions.
   */
  static getRoutingDecision(userId?: string): { target: 'PRIMARY' | 'REPLICA'; reason: string } {
    if (this.shouldReadFromPrimary(userId)) {
      const elapsed = Date.now() - (userLastWriteTimestamps.get(userId!) || 0);
      return {
        target: 'PRIMARY',
        reason: `Recent user write detected (${elapsed}ms ago < ${REPLICATION_LAG_WINDOW_MS}ms window). Read-Your-Own-Writes consistency enforced.`,
      };
    }
    return {
      target: 'REPLICA',
      reason: 'No recent user write detected within replication lag window. Routed to Read Replica.',
    };
  }

  /**
   * Clears write watermarks (used in test teardown).
   */
  static resetWatermarks(): void {
    userLastWriteTimestamps.clear();
  }
}

/**
 * Express Middleware: Read-Your-Own-Writes Tracker
 * Automatically intercepts write operations (POST, PUT, PATCH, DELETE)
 * and records the timestamp for the authenticated user.
 */
export function readYourOwnWritesMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  
  if (isMutation) {
    res.on('finish', () => {
      // Only record write if the mutation succeeded (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.id) {
        DatabaseRouter.recordUserWrite(req.user.id);
      }
    });
  }

  next();
}
