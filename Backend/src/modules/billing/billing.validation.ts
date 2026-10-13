import { z } from 'zod';

export const checkoutSchema = z.object({
  planId: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']).default('STARTER'),
  seats: z.number().int().min(1, 'Must purchase at least 1 seat.').max(1000),
  currency: z.literal('NGN').default('NGN'),
  redirectUrl: z.string().url().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
