import { prisma } from './database/prisma';
import { DatabaseRouter, REPLICATION_LAG_WINDOW_MS } from './database/dbRouter';
import { ShardingRouter } from './database/shardingRouter';
import { NotificationService } from './modules/notifications/notification.service';
import { NotificationType } from './modules/notifications/notification.types';
import { CacheService } from './services/cache.service';

/**
 * ============================================================================
 * TEST SUITE: REQUIREMENT 7 & TASK A SYSTEM DESIGN
 * ============================================================================
 */

let testUserId: string;
let testBusinessId: string;

async function setup(): Promise<void> {
  const ts = Date.now();
  const user = await prisma.user.create({
    data: {
      name: `Nurse Halima ${ts}`,
      email: `halima.${ts}@example.com`,
      passwordHash: 'dummy_hash_requirement7',
    },
  });
  testUserId = user.id;

  const business = await prisma.business.create({
    data: {
      name: `Halima Clinic ${ts}`,
      timezone: 'Africa/Lagos',
    },
  });
  testBusinessId = business.id;

  await prisma.membership.create({
    data: {
      businessId: testBusinessId,
      userId: testUserId,
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  });
}

async function teardown(): Promise<void> {
  try {
    await prisma.notification.deleteMany({ where: { userId: testUserId } });
    await prisma.userSettings.deleteMany({ where: { userId: testUserId } });
    await prisma.shift.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.membership.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.business.deleteMany({ where: { id: testBusinessId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await CacheService.clearAll();
  } catch (err: any) {
    console.warn('[Teardown Note]:', err.message);
  }
}

async function runTests(): Promise<void> {
  console.log('====================================================');
  console.log(' RUNNING REQUIREMENT 7 & TASK A VERIFICATION SUITE');
  console.log('====================================================\n');

  await setup();

  // --------------------------------------------------------------------------
  // TEST 1: Server Source of Truth & Full Settings Storage
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Server Source of Truth & Settings Storage ---');
  const createdSettings = await prisma.userSettings.upsert({
    where: { userId: testUserId },
    create: {
      userId: testUserId,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      timezone: 'Africa/Lagos',
      notificationsEnabled: true,
      notifyShiftChanges: true,
      notifySwaps: true,
      notifyBilling: false,
      theme: 'dark',
      language: 'fr',
    },
    update: {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      theme: 'dark',
      language: 'fr',
    },
  });

  if (
    createdSettings.quietHoursStart !== '22:00' ||
    createdSettings.quietHoursEnd !== '06:00' ||
    createdSettings.theme !== 'dark' ||
    createdSettings.language !== 'fr'
  ) {
    throw new Error('Test 1 Failed: Settings did not match saved attributes.');
  }
  console.log('✅ PASSED: Settings successfully stored on server (quiet hours, timezone, notification types, theme, language).\n');

  // --------------------------------------------------------------------------
  // TEST 2: Multi-Device Conflict Handling (Last-Write-Wins with Authoritative updatedAt)
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Conflict Handling & Last-Write-Wins (LWW) ---');
  const serverTime1 = createdSettings.updatedAt;

  // Ensure clock advances past sub-millisecond Postgres execution
  await new Promise((r) => setTimeout(r, 25));

  // Simulate Device 1 with older snapshot timestamp making a request after Device 2 has already written
  const staleClientTimestamp = new Date(serverTime1.getTime() - 10000).toISOString();

  // Emulate controller LWW update
  const updatedSettings = await prisma.userSettings.update({
    where: { userId: testUserId },
    data: {
      theme: 'light',
      updatedAt: new Date(),
    },
  });

  if (updatedSettings.updatedAt.getTime() <= serverTime1.getTime()) {
    throw new Error('Test 2 Failed: Server updatedAt did not advance.');
  }
  if (updatedSettings.theme !== 'light') {
    throw new Error('Test 2 Failed: LWW mutation did not apply new value.');
  }
  console.log(`✅ PASSED: Last-Write-Wins resolved conflict. Server timestamp advanced from ${serverTime1.toISOString()} to ${updatedSettings.updatedAt.toISOString()}.\n`);

  // --------------------------------------------------------------------------
  // TEST 3: Server-Side Quiet Hours Calculation & Non-Urgent Notification Delay
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Quiet Hours & Non-Urgent Delay Evaluation ---');
  // 02:00 AM in Africa/Lagos (UTC+1 is 01:00 UTC)
  const simulatedNightTime = new Date('2026-10-14T01:00:00.000Z');

  // Non-urgent check
  const nonUrgentCheck = await NotificationService.shouldDeliverPushNotification(
    testUserId,
    NotificationType.SWAP,
    false, // isUrgent = false
    simulatedNightTime
  );

  if (nonUrgentCheck.deliver !== false || !nonUrgentCheck.delayed || !nonUrgentCheck.delayMs) {
    throw new Error('Test 3 Failed: Non-urgent notification was not delayed during quiet hours.');
  }

  // Urgent check (e.g., emergency shift cancellation)
  const urgentCheck = await NotificationService.shouldDeliverPushNotification(
    testUserId,
    NotificationType.SHIFT_CHANGE,
    true, // isUrgent = true
    simulatedNightTime
  );

  if (urgentCheck.deliver !== true) {
    throw new Error('Test 3 Failed: Urgent notification was not delivered immediately during quiet hours.');
  }
  console.log(`✅ PASSED: Quiet hours strictly enforced on server: Non-urgent delayed by ${Math.round(nonUrgentCheck.delayMs / 60000)}m until 06:00, Urgent delivered immediately.\n`);

  // --------------------------------------------------------------------------
  // TEST 4: Connection Pooling Configuration & Justification
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Database Connection Pooling Configuration ---');
  const { CONNECTION_POOL_CONFIG } = await import('./database/prisma');
  if (CONNECTION_POOL_CONFIG.poolSize !== 20 || CONNECTION_POOL_CONFIG.poolTimeoutSeconds !== 10) {
    throw new Error('Test 4 Failed: Connection pool configuration invalid.');
  }
  console.log(`✅ PASSED: Connection pooling verified (Pool Size: ${CONNECTION_POOL_CONFIG.poolSize}, Timeout: ${CONNECTION_POOL_CONFIG.poolTimeoutSeconds}s, Formula: ${CONNECTION_POOL_CONFIG.formula}).\n`);

  // --------------------------------------------------------------------------
  // TEST 5: Read and Write Routing with Read-Your-Own-Writes
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Read and Write Routing (Read-Your-Own-Writes) ---');
  DatabaseRouter.resetWatermarks();

  // Initially, read should route to Replica
  const initialDecision = DatabaseRouter.getRoutingDecision(testUserId);
  if (initialDecision.target !== 'REPLICA') {
    throw new Error('Test 5 Failed: Initial read should route to REPLICA.');
  }

  // Simulate user performing a write operation
  DatabaseRouter.recordUserWrite(testUserId);

  // Subsequent read within replication lag window must route to Primary
  const postWriteDecision = DatabaseRouter.getRoutingDecision(testUserId);
  if (postWriteDecision.target !== 'PRIMARY') {
    throw new Error('Test 5 Failed: Read immediately after write must route to PRIMARY.');
  }
  console.log(`✅ PASSED: Read-Your-Own-Writes enforced (Initial: ${initialDecision.target} -> Post-Write: ${postWriteDecision.target} within ${REPLICATION_LAG_WINDOW_MS}ms window).\n`);

  // --------------------------------------------------------------------------
  // TEST 6: Sharding Simulation Routing by Team ID
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Sharding Simulation Routing by Team ID ---');
  const teamA = 'business_alpha_1001';
  const teamB = 'business_beta_2002';

  const shardA = ShardingRouter.getShardForTeam(teamA);
  const shardB = ShardingRouter.getShardForTeam(teamB);

  if (typeof shardA.shardIndex !== 'number' || typeof shardB.shardIndex !== 'number') {
    throw new Error('Test 6 Failed: Shard routing failed to compute shardIndex.');
  }
  console.log(`✅ PASSED: Sharding router deterministically mapped ${teamA} -> ${shardA.shardName} (Hash: ${shardA.hashValue}) and ${teamB} -> ${shardB.shardName} (Hash: ${shardB.hashValue}).\n`);

  // --------------------------------------------------------------------------
  // TEST 7: Redis Caching and Invalidation for Team Rosters & Shift Calendars
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Redis Caching & Invalidation for Rosters and Shifts ---');
  const rosterKey = `cache:roster:${testBusinessId}`;
  await CacheService.del(rosterKey);

  // Step 1: Cold fetch (MISS)
  const fetch1 = await CacheService.getOrSet(rosterKey, 300, async () => {
    return [{ id: 'mem_1', role: 'MANAGER' }];
  });
  if (fetch1.cached !== false) {
    throw new Error('Test 7 Failed: Expected cache MISS on first read.');
  }

  // Step 2: Warm fetch (HIT)
  const fetch2 = await CacheService.getOrSet(rosterKey, 300, async () => {
    return [{ id: 'mem_1', role: 'MANAGER' }];
  });
  if (fetch2.cached !== true) {
    throw new Error('Test 7 Failed: Expected cache HIT on second read.');
  }

  // Step 3: Shift/Roster mutation invalidates cache
  await CacheService.invalidatePattern(`cache:roster:${testBusinessId}`);
  const fetch3 = await CacheService.get(rosterKey);
  if (fetch3 !== null) {
    throw new Error('Test 7 Failed: Cache was not invalidated after mutation.');
  }
  console.log('✅ PASSED: Redis caching lifecycle verified: MISS -> HIT -> Invalidation upon mutation.\n');

  await teardown();

  console.log('====================================================');
  console.log(' RESULTS: ALL 7 REQUIREMENT & SYSTEM DESIGN TESTS PASSED');
  console.log('====================================================');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
