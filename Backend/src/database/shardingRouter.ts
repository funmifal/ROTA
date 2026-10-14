import { PrismaClient } from '@prisma/client';

/**
 * ============================================================================
 * Task A: Multi-Tenant Database Sharding Simulation
 * ============================================================================
 * 
 * Architecture:
 * - Two separate database shards: Shard 1 (`shard_1`) and Shard 2 (`shard_2`).
 * - Partitioning / Routing Key: `team_id` (Business ID).
 * - Sharding Algorithm: Deterministic FNV-1a Hash modulo 2.
 * 
 * Every team's scheduling data (shifts, shift assignments, rosters, swaps)
 * resides entirely on its assigned shard, ensuring single-tenant operations
 * require zero distributed joins or two-phase commits.
 * ============================================================================
 */

function getShardDatabaseUrl(shardSchema: 'shard_1' | 'shard_2'): string {
  const baseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rota_dev?schema=public';
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('schema', shardSchema);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

// Dedicated Prisma Clients for each shard
export const shard1Prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_SHARD_1_URL || getShardDatabaseUrl('shard_1'),
    },
  },
  log: ['error'],
});

export const shard2Prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_SHARD_2_URL || getShardDatabaseUrl('shard_2'),
    },
  },
  log: ['error'],
});

export interface ShardRoutingResult {
  shardIndex: 0 | 1;
  shardName: 'shard_1' | 'shard_2';
  client: PrismaClient;
  hashValue: number;
}

export class ShardingRouter {
  /**
   * Computes a deterministic 32-bit FNV-1a hash of the team_id.
   */
  static hashTeamId(teamId: string): number {
    let hash = 2166136261;
    for (let i = 0; i < teamId.length; i++) {
      hash ^= teamId.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  /**
   * Routes a given team_id to its assigned database shard (Shard 0 or Shard 1).
   */
  static getShardForTeam(teamId: string): ShardRoutingResult {
    if (!teamId) {
      throw new Error('[ShardingRouter] Cannot route empty or undefined team_id.');
    }

    const hashValue = this.hashTeamId(teamId);
    const shardIndex = (hashValue % 2) as 0 | 1;
    const shardName = shardIndex === 0 ? 'shard_1' : 'shard_2';
    const client = shardIndex === 0 ? shard1Prisma : shard2Prisma;

    return {
      shardIndex,
      shardName,
      client,
      hashValue,
    };
  }

  /**
   * Initializes schemas for the two shards in the development database.
   */
  static async initializeShardSchemas(): Promise<void> {
    try {
      await shard1Prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS shard_1;');
      await shard2Prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS shard_2;');
      console.log('[ShardingRouter] Shard schemas (shard_1, shard_2) verified.');
    } catch (err: any) {
      console.warn('[ShardingRouter] Schema initialization note:', err.message);
    }
  }
}
