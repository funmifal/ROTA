import { MembershipRole, MembershipStatus } from '@prisma/client';

export interface CreateInvitationInput {
  email: string;
  role: MembershipRole;
}

export interface UpdateMemberInput {
  role?: MembershipRole;
  status?: MembershipStatus;
}

export function validateCreateInvitationInput(input: any): CreateInvitationInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid request payload.');
  }

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new Error('Please provide a valid recipient email address.');
  }

  let role: MembershipRole = MembershipRole.STAFF;
  if (input.role) {
    if (input.role === 'MANAGER') {
      role = MembershipRole.MANAGER;
    } else if (input.role === 'STAFF') {
      role = MembershipRole.STAFF;
    } else {
      throw new Error('Invalid invitation role. Supported roles: STAFF, MANAGER.');
    }
  }

  return { email, role };
}

export function validateUpdateMemberInput(input: any): UpdateMemberInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid request payload.');
  }

  const validated: UpdateMemberInput = {};

  if (input.role !== undefined) {
    if (input.role === 'MANAGER') {
      validated.role = MembershipRole.MANAGER;
    } else if (input.role === 'STAFF') {
      validated.role = MembershipRole.STAFF;
    } else {
      throw new Error('Invalid role. Supported roles: STAFF, MANAGER.');
    }
  }

  if (input.status !== undefined) {
    if (Object.values(MembershipStatus).includes(input.status)) {
      validated.status = input.status;
    } else {
      throw new Error('Invalid membership status.');
    }
  }

  return validated;
}
