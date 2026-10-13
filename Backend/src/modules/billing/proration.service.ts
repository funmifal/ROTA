import { PlanTier, calculateMonthlyPlanCostCents, PLANS } from './billing.types';

export interface ProrationInput {
  currentPlan: PlanTier;
  currentSeats: number;
  newPlan: PlanTier;
  newSeats: number;
  periodStartDate: Date;
  periodEndDate: Date;
  changeDate: Date;
}

export interface ProrationResult {
  isUpgrade: boolean;
  isDowngrade: boolean;
  totalPeriodDays: number;
  daysUsed: number;
  daysRemaining: number;
  currentPlanMonthlyCostCents: number;
  newPlanMonthlyCostCents: number;
  unusedCreditCents: number;
  newPlanRemainingCostCents: number;
  chargeTodayCents: number;
  scheduledForNextPeriod: boolean;
  effectiveDate: Date;
  description: string;
}

export class ProrationService {
  /**
   * Deterministically calculates subscription proration using integer cents.
   * Rounding rule: Math.floor() for all fractional amounts (round down to whole cents).
   * 
   * Formula:
   *   unusedCreditCents = Math.floor((currentPlanMonthlyCost * daysRemaining) / totalDays)
   *   newPlanRemainingCost = Math.floor((newPlanMonthlyCost * daysRemaining) / totalDays)
   *   chargeToday = Math.max(0, newPlanRemainingCost - unusedCreditCents)  [for upgrades / seat increases]
   *   Downgrades are applied at the end of the billing cycle (chargeToday = 0).
   */
  static calculateProration(input: ProrationInput): ProrationResult {
    const {
      currentPlan,
      currentSeats,
      newPlan,
      newSeats,
      periodStartDate,
      periodEndDate,
      changeDate,
    } = input;

    // Validate date sequence
    if (periodEndDate <= periodStartDate) {
      throw new Error('Billing period end date must be strictly after start date.');
    }

    const startMs = periodStartDate.getTime();
    const endMs = periodEndDate.getTime();
    const changeMs = Math.max(startMs, Math.min(endMs, changeDate.getTime()));

    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const totalPeriodDays = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY));
    const daysRemaining = Math.max(0, Math.min(totalPeriodDays, Math.round((endMs - changeMs) / MS_PER_DAY)));
    const daysUsed = totalPeriodDays - daysRemaining;

    const currentPlanMonthlyCostCents = calculateMonthlyPlanCostCents(currentPlan, currentSeats);
    const newPlanMonthlyCostCents = calculateMonthlyPlanCostCents(newPlan, newSeats);

    // Credit for unused current plan time (rounded down)
    const unusedCreditCents = Math.floor((currentPlanMonthlyCostCents * daysRemaining) / totalPeriodDays);

    // Cost of new plan for the remaining days (rounded down)
    const newPlanRemainingCostCents = Math.floor((newPlanMonthlyCostCents * daysRemaining) / totalPeriodDays);

    const isDowngrade = newPlanMonthlyCostCents < currentPlanMonthlyCostCents;
    const isUpgrade = newPlanMonthlyCostCents > currentPlanMonthlyCostCents;

    let chargeTodayCents = 0;
    let scheduledForNextPeriod = false;
    let effectiveDate = changeDate;

    if (isDowngrade) {
      // Downgrades take effect at the end of the paid period to avoid refund complications
      chargeTodayCents = 0;
      scheduledForNextPeriod = true;
      effectiveDate = periodEndDate;
    } else {
      // Upgrades or seat additions charge the prorated net difference immediately
      chargeTodayCents = Math.max(0, newPlanRemainingCostCents - unusedCreditCents);
      scheduledForNextPeriod = false;
      effectiveDate = changeDate;
    }

    const currentPlanName = PLANS[currentPlan].name;
    const newPlanName = PLANS[newPlan].name;

    const description = isDowngrade
      ? `Scheduled downgrade from ${currentPlanName} (${currentSeats} seats) to ${newPlanName} (${newSeats} seats) effective on ${periodEndDate.toISOString().split('T')[0]}.`
      : isUpgrade
      ? `Prorated upgrade from ${currentPlanName} to ${newPlanName} for remaining ${daysRemaining}/${totalPeriodDays} days. Credit: $${(unusedCreditCents / 100).toFixed(2)}, New cost: $${(newPlanRemainingCostCents / 100).toFixed(2)}, Due today: $${(chargeTodayCents / 100).toFixed(2)}.`
      : `Plan unchanged. Due today: $0.00.`;

    return {
      isUpgrade,
      isDowngrade,
      totalPeriodDays,
      daysUsed,
      daysRemaining,
      currentPlanMonthlyCostCents,
      newPlanMonthlyCostCents,
      unusedCreditCents,
      newPlanRemainingCostCents,
      chargeTodayCents,
      scheduledForNextPeriod,
      effectiveDate,
      description,
    };
  }
}
