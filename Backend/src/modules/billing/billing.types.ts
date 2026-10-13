import { PlanTier, SubscriptionStatus, LedgerEntryType, PaymentStatus } from '@prisma/client';

export interface PlanConfig {
  name: string;
  priceCents: number;
  includedSeats: number;
  extraSeatPriceCents: number | null; // null if extra seats not supported
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  [PlanTier.STARTER]: {
    name: 'Starter',
    priceCents: 2000, // $20.00 per month
    includedSeats: 5,
    extraSeatPriceCents: null, // Not available
  },
  [PlanTier.TEAM]: {
    name: 'Team',
    priceCents: 5000, // $50.00 per month
    includedSeats: 15,
    extraSeatPriceCents: 300, // $3.00 per month per extra seat
  },
  [PlanTier.BUSINESS]: {
    name: 'Business',
    priceCents: 12000, // $120.00 per month
    includedSeats: 40,
    extraSeatPriceCents: 200, // $2.00 per month per extra seat
  },
};

/**
 * Calculates deterministic monthly cost in integer cents.
 */
export function calculateMonthlyPlanCostCents(plan: PlanTier, totalSeats: number): number {
  const config = PLANS[plan];
  if (!config) {
    throw new Error(`Unknown plan tier: ${plan}`);
  }

  if (totalSeats <= config.includedSeats) {
    return config.priceCents;
  }

  if (config.extraSeatPriceCents === null) {
    throw new Error(`Plan ${config.name} does not support extra seats beyond ${config.includedSeats}. Please upgrade to a higher plan.`);
  }

  const extraSeats = totalSeats - config.includedSeats;
  return config.priceCents + (extraSeats * config.extraSeatPriceCents);
}

export { PlanTier, SubscriptionStatus, LedgerEntryType, PaymentStatus };
