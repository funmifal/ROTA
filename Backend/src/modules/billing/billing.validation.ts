import { z } from 'zod';
import { PlanTier } from '@prisma/client';

export const checkoutSchema = z.object({
  planId: z.nativeEnum(PlanTier).default(PlanTier.STARTER),
  seats: z.number().int().min(1, 'Must purchase at least 1 seat.').max(1000),
  currency: z.literal('USD').default('USD'),
  idempotencyKey: z.string().trim().min(1).optional(),
});

export const planChangeSchema = z.object({
  newPlan: z.nativeEnum(PlanTier),
  newSeats: z.number().int().min(1, 'Must have at least 1 seat.').max(1000),
  idempotencyKey: z.string().trim().min(1).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type PlanChangeInput = z.infer<typeof planChangeSchema>;
