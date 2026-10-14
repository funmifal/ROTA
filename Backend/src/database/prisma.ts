import { PrismaClient } from '@prisma/client';

/**
 * ============================================================================
 * Task A: PostgreSQL Connection Pooling Configuration & Justification
 * ============================================================================
 * 
 * Target Pool Size: 20 connections
 * Pool Timeout: 10 seconds
 * 
 * Justification & Sizing Formula:
 *   Max Connections = ((Core CPU count * 2) + Effective Disk/SSD Concurrency)
 * 
 * Why 20 connections?
 * 1. Process-per-connection overhead:
 *    Unlike multithreaded databases, PostgreSQL creates a separate backend process
 *    for each connection, allocating private working memory (work_mem), maintenance buffers,
 *    and system file descriptors (~5MB - 10MB per connection).
 * 2. CPU Thrashing & Lock Contention:
 *    Having hundreds of direct connections thrashes CPU caches and increases kernel
 *    context switching overhead. A lean pool of 10-20 connections allows PostgreSQL's
 *    query executor to run queries at maximum throughput without queueing inside Postgres.
 * 3. Node.js Event Loop Concurrency:
 *    Because Node.js is asynchronous and non-blocking, a pool of 20 connections can
 *    efficiently serve thousands of concurrent HTTP requests when queries are properly
 *    indexed and execute in 1-5 milliseconds.
 * 4. Prisma Connection Pooling:
 *    Prisma Client implements an internal Rust-based connection pool. We pass
 *    `connection_limit=20` and `pool_timeout=10` into the datasource URL to guarantee
 *    predictable resource utilization and prevent connection exhaustion.
 * ============================================================================
 */

function getPooledDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL || '';
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '20');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '10');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getPooledDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export const CONNECTION_POOL_CONFIG = {
  poolSize: 20,
  poolTimeoutSeconds: 10,
  idleTimeoutSeconds: 30,
  formula: '((CPU_CORES * 2) + EFFECTIVE_SPINDLE_CONCURRENCY)',
  justification: 'Prevents PostgreSQL process thrashing while multiplexing asynchronous Node.js requests.',
};
