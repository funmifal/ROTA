import { prisma } from '../database/prisma';

async function seedAndBenchmark() {
  console.log('--- 1. Setting up Demo Business for 10,000 Activity Records ---');

  // Find or create test business
  let business = await prisma.business.findFirst({
    where: { name: 'Benchmark Cafe' },
  });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'Benchmark Cafe',
        industry: 'Hospitality',
        timezone: 'Africa/Lagos',
      },
    });
  }

  const businessId = business.id;
  console.log(`Using Business ID: ${businessId}`);

  // Count existing audit logs
  const existingCount = await prisma.auditLog.count({
    where: { businessId },
  });
  console.log(`Current activity records in business: ${existingCount}`);

  const TARGET_COUNT = 10000;
  if (existingCount < TARGET_COUNT) {
    const toInsert = TARGET_COUNT - existingCount;
    console.log(`Seeding ${toInsert} activity records in batches of 1,000...`);

    const actions = [
      'SHIFT_CREATED',
      'SHIFT_PUBLISHED',
      'SWAP_REQUESTED',
      'SWAP_APPROVED',
      'SWAP_REJECTED',
      'MEMBER_JOINED',
      'MEMBER_INVITED',
      'AVAILABILITY_UPDATED',
      'SCHEDULE_PUBLISHED',
      'SHIFT_CANCELLED',
    ];

    const resources = ['shift', 'swap', 'membership', 'schedule', 'availability'];
    const now = Date.now();
    const batchSize = 1000;

    for (let b = 0; b < toInsert; b += batchSize) {
      const currentBatchSize = Math.min(batchSize, toInsert - b);
      const batchData = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const itemIndex = b + i;
        // Distribute timestamps over past 30 days with some duplicates to test tie-breaker
        const timestampOffsetMs = (toInsert - itemIndex) * 250000; // ~every 4 minutes
        // Intentionally create duplicate timestamps every 50 items to prove tie-breaker
        const timestamp = new Date(now - timestampOffsetMs + (itemIndex % 5 === 0 ? 0 : itemIndex * 10));
        const action = actions[itemIndex % actions.length];
        const resource = resources[itemIndex % resources.length];

        batchData.push({
          businessId,
          action,
          resource,
          resourceId: `res_${itemIndex}`,
          metadata: {
            note: `Activity item #${itemIndex + 1}`,
            details: `Logged event for ${resource} ${action}`,
          },
          createdAt: timestamp,
        });
      }

      await prisma.auditLog.createMany({
        data: batchData,
      });

      process.stdout.write(`Inserted ${b + currentBatchSize}/${toInsert}...\r`);
    }
    console.log(`\nSuccessfully seeded ${toInsert} records!`);
  }

  const totalCount = await prisma.auditLog.count({ where: { businessId } });
  console.log(`Total activity records now: ${totalCount}`);

  // Pick a realistic cursor from around item 5,000
  const midItem = await prisma.auditLog.findMany({
    where: { businessId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: 5000,
    take: 1,
  });

  const cursorCreatedAt = midItem[0].createdAt.toISOString();
  const cursorId = midItem[0].id;
  console.log(`Sample cursor: createdAt = ${cursorCreatedAt}, id = ${cursorId}`);

  // Test queries:
  // Query 1: Tuple syntax ("createdAt", id) < ($cursorCreatedAt, $cursorId)
  const tupleQuery = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, "businessId", action, resource, "createdAt"
    FROM audit_logs
    WHERE "businessId" = '${businessId}'
      AND ("createdAt", id) < ('${cursorCreatedAt}'::timestamp, '${cursorId}')
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 20;
  `;

  // --- 2. EXPLAIN ANALYZE BEFORE THE COMPOUND INDEX ---
  console.log('\n--- 2. BENCHMARK BEFORE COMPOUND INDEX ---');
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "idx_audit_logs_cursor";`);

  console.log('Running query BEFORE compound index...');
  const beforeResult: any = await prisma.$queryRawUnsafe(tupleQuery);
  const beforePlan = beforeResult.map((r: any) => r['QUERY PLAN']).join('\n');
  console.log('\n=== EXPLAIN ANALYZE (BEFORE COMPOUND INDEX) ===\n' + beforePlan);

  // --- 3. CREATE THE COMPOUND INDEX ---
  console.log('\n--- 3. CREATING COMPOUND INDEX: ("businessId", "createdAt" DESC, "id" DESC) ---');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "idx_audit_logs_cursor" 
    ON audit_logs ("businessId", "createdAt" DESC, "id" DESC);
  `);
  console.log('Compound index created successfully!');

  // --- 4. EXPLAIN ANALYZE AFTER THE COMPOUND INDEX ---
  console.log('Running query AFTER compound index...');
  const afterResult: any = await prisma.$queryRawUnsafe(tupleQuery);
  const afterPlan = afterResult.map((r: any) => r['QUERY PLAN']).join('\n');
  console.log('\n=== EXPLAIN ANALYZE (AFTER COMPOUND INDEX) ===\n' + afterPlan);

  console.log('\n--- BENCHMARK COMPLETE ---');
}

seedAndBenchmark()
  .catch((e) => {
    console.error('Error during benchmark:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
