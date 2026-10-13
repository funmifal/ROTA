import { z } from 'zod';

export const requestSwapSchema = z.object({
  shiftAssignmentId: z.string().min(1, 'shiftAssignmentId is required.'),
  reason: z.string().trim().max(250).optional(),
  targetMembershipId: z.string().min(1).optional(),
});

export type RequestSwapInput = z.infer<typeof requestSwapSchema>;
