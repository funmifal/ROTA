import { MembershipRole, MembershipStatus } from '@prisma/client';
import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().trim().email('Please provide a valid recipient email address.').toLowerCase(),
  role: z.enum([MembershipRole.STAFF, MembershipRole.MANAGER]).default(MembershipRole.STAFF),
});

export const updateMemberSchema = z.object({
  role: z.enum([MembershipRole.STAFF, MembershipRole.MANAGER, MembershipRole.OWNER]).optional(),
  status: z.nativeEnum(MembershipStatus).optional(),
}).refine((data) => data.role !== undefined || data.status !== undefined, {
  message: 'At least one of role or status must be provided.',
});

export const signUpWithInvitationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(64),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export function validateCreateInvitationInput(input: any): CreateInvitationInput {
  return createInvitationSchema.parse(input);
}

export function validateUpdateMemberInput(input: any): UpdateMemberInput {
  return updateMemberSchema.parse(input);
}
