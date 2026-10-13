import { ProrationService } from './modules/billing/proration.service';
import { PlanTier, calculateMonthlyPlanCostCents, PLANS } from './modules/billing/billing.types';

function runProrationUnitTests() {
  console.log('====================================================');
  console.log(' RUNNING PRORATION & BILLING UNIT TESTS (8+ CASES)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assertEqual(actual: any, expected: any, testName: string) {
    if (actual === expected) {
      console.log(`✅ PASSED: ${testName} (Got ${actual})`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${testName} - Expected ${expected}, but got ${actual}`);
      failed++;
    }
  }

  const baseStart = new Date('2026-06-01T00:00:00.000Z');
  const baseEnd = new Date('2026-07-01T00:00:00.000Z'); // 30-day period

  // -------------------------------------------------------------------------
  // CASE 1: Upgrade Mid-Cycle (Ifeanyi's Cafe Scenario)
  // Starter ($20) -> Team ($50), Day 11 (20 days remaining out of 30)
  // -------------------------------------------------------------------------
  console.log('--- CASE 1: Upgrade Mid-Cycle (Prompt Scenario) ---');
  const day11 = new Date('2026-06-11T00:00:00.000Z');
  const res1 = ProrationService.calculateProration({
    currentPlan: PlanTier.STARTER,
    currentSeats: 5,
    newPlan: PlanTier.TEAM,
    newSeats: 15,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: day11,
  });

  assertEqual(res1.unusedCreditCents, 1333, 'Case 1 - Unused Starter credit (2000 * 20 / 30 = 1333)');
  assertEqual(res1.newPlanRemainingCostCents, 3333, 'Case 1 - Team cost for remaining 20 days (5000 * 20 / 30 = 3333)');
  assertEqual(res1.chargeTodayCents, 2000, 'Case 1 - Net charge today (3333 - 1333 = 2000 cents / $20.00)');
  assertEqual(res1.scheduledForNextPeriod, false, 'Case 1 - Upgrades apply immediately');

  // -------------------------------------------------------------------------
  // CASE 2: Downgrade Mid-Cycle
  // Team ($50) -> Starter ($20), Day 11
  // Downgrade scheduled at end of period, charge today = $0
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 2: Downgrade Mid-Cycle ---');
  const res2 = ProrationService.calculateProration({
    currentPlan: PlanTier.TEAM,
    currentSeats: 15,
    newPlan: PlanTier.STARTER,
    newSeats: 5,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: day11,
  });

  assertEqual(res2.chargeTodayCents, 0, 'Case 2 - Downgrade charge today is $0.00');
  assertEqual(res2.scheduledForNextPeriod, true, 'Case 2 - Downgrade scheduled for end of period');
  assertEqual(res2.effectiveDate.getTime(), baseEnd.getTime(), 'Case 2 - Effective date is period end date');

  // -------------------------------------------------------------------------
  // CASE 3: Adding Seats Mid-Cycle on Same Plan (Team)
  // Team 15 seats ($5000 cents) -> 18 seats ($5900 cents, +3 seats @ $300), Day 16 (15 days left)
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 3: Adding Seats Mid-Cycle ---');
  const day16 = new Date('2026-06-16T00:00:00.000Z');
  const res3 = ProrationService.calculateProration({
    currentPlan: PlanTier.TEAM,
    currentSeats: 15,
    newPlan: PlanTier.TEAM,
    newSeats: 18,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: day16,
  });

  assertEqual(res3.unusedCreditCents, 2500, 'Case 3 - Unused credit for 15 seats (5000 * 15 / 30 = 2500)');
  assertEqual(res3.newPlanRemainingCostCents, 2950, 'Case 3 - Cost for 18 seats for 15 days (5900 * 15 / 30 = 2950)');
  assertEqual(res3.chargeTodayCents, 450, 'Case 3 - Prorated extra seat charge (2950 - 2500 = 450 cents / $4.50)');
  assertEqual(res3.scheduledForNextPeriod, false, 'Case 3 - Seat addition takes effect immediately');

  // -------------------------------------------------------------------------
  // CASE 4: Removing Seats Mid-Cycle on Same Plan (Team)
  // Team 18 seats ($5900 cents) -> 15 seats ($5000 cents), Day 16
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 4: Removing Seats Mid-Cycle ---');
  const res4 = ProrationService.calculateProration({
    currentPlan: PlanTier.TEAM,
    currentSeats: 18,
    newPlan: PlanTier.TEAM,
    newSeats: 15,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: day16,
  });

  assertEqual(res4.chargeTodayCents, 0, 'Case 4 - Seat removal charge today is $0.00');
  assertEqual(res4.scheduledForNextPeriod, true, 'Case 4 - Seat reduction takes effect at end of period');

  // -------------------------------------------------------------------------
  // CASE 5: Change on the FIRST Day of Period (Day 0, 30 days remaining)
  // Starter ($2000) -> Business ($12000, 40 seats)
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 5: Change on the First Day of Period ---');
  const res5 = ProrationService.calculateProration({
    currentPlan: PlanTier.STARTER,
    currentSeats: 5,
    newPlan: PlanTier.BUSINESS,
    newSeats: 40,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: baseStart, // First day
  });

  assertEqual(res5.daysRemaining, 30, 'Case 5 - Full 30 days remaining');
  assertEqual(res5.unusedCreditCents, 2000, 'Case 5 - Full Starter credit applied (2000 cents)');
  assertEqual(res5.newPlanRemainingCostCents, 12000, 'Case 5 - Full Business cost (12000 cents)');
  assertEqual(res5.chargeTodayCents, 10000, 'Case 5 - Net charge (12000 - 2000 = 10000 cents / $100.00)');

  // -------------------------------------------------------------------------
  // CASE 6: Change on the LAST Day of Period (Day 30, 0 days remaining)
  // Starter ($2000) -> Team ($5000)
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 6: Change on the Last Day of Period ---');
  const res6 = ProrationService.calculateProration({
    currentPlan: PlanTier.STARTER,
    currentSeats: 5,
    newPlan: PlanTier.TEAM,
    newSeats: 15,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: baseEnd, // Last day (0 days left)
  });

  assertEqual(res6.daysRemaining, 0, 'Case 6 - 0 days remaining');
  assertEqual(res6.unusedCreditCents, 0, 'Case 6 - $0 credit remaining');
  assertEqual(res6.newPlanRemainingCostCents, 0, 'Case 6 - $0 new plan remaining');
  assertEqual(res6.chargeTodayCents, 0, 'Case 6 - $0 charge today; renewal will bill full new rate');

  // -------------------------------------------------------------------------
  // CASE 7: Two Changes in ONE Billing Period
  // Change 1: Day 11 (20 days left): Starter ($2000) -> Team ($5000) => Paid 2000 cents
  // Change 2: Day 21 (10 days left): Team ($5000) -> Business ($12000)
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 7: Two Changes in One Billing Period ---');
  const day21 = new Date('2026-06-21T00:00:00.000Z');
  const res7 = ProrationService.calculateProration({
    currentPlan: PlanTier.TEAM,
    currentSeats: 15,
    newPlan: PlanTier.BUSINESS,
    newSeats: 40,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: day21,
  });

  assertEqual(res7.daysRemaining, 10, 'Case 7 - 10 days remaining for second change');
  assertEqual(res7.unusedCreditCents, 1666, 'Case 7 - Unused credit from active Team rate (5000 * 10 / 30 = 1666)');
  assertEqual(res7.newPlanRemainingCostCents, 4000, 'Case 7 - Business cost for remaining 10 days (12000 * 10 / 30 = 4000)');
  assertEqual(res7.chargeTodayCents, 2334, 'Case 7 - Net charge today (4000 - 1666 = 2334 cents / $23.34)');

  // -------------------------------------------------------------------------
  // CASE 8: Business Plan with Extra Seats
  // Business with 40 seats ($12000) -> Business with 45 seats (+5 seats @ $200 = $13000), Day 16 (15 days left)
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 8: Business Plan with Extra Seats ---');
  const res8 = ProrationService.calculateProration({
    currentPlan: PlanTier.BUSINESS,
    currentSeats: 40,
    newPlan: PlanTier.BUSINESS,
    newSeats: 45,
    periodStartDate: baseStart,
    periodEndDate: baseEnd,
    changeDate: day16,
  });

  assertEqual(res8.unusedCreditCents, 6000, 'Case 8 - Unused credit for 40 seats (12000 * 15 / 30 = 6000)');
  assertEqual(res8.newPlanRemainingCostCents, 6500, 'Case 8 - Cost for 45 seats for 15 days (13000 * 15 / 30 = 6500)');
  assertEqual(res8.chargeTodayCents, 500, 'Case 8 - Net charge today (6500 - 6000 = 500 cents / $5.00)');

  // -------------------------------------------------------------------------
  // CASE 9: Starter Plan Extra Seat Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 9: Starter Plan Extra Seat Rejection ---');
  let rejected = false;
  try {
    calculateMonthlyPlanCostCents(PlanTier.STARTER, 6);
  } catch (err: any) {
    rejected = true;
  }
  assertEqual(rejected, true, 'Case 9 - Extra seats on Starter strictly rejected with error');

  console.log('\n====================================================');
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runProrationUnitTests();
