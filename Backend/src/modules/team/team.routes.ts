import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember, requireBusinessRole } from '../../middleware/rbac';
import { TeamController } from './team.controller';
import { MembershipRole } from '@prisma/client';

const router = Router({ mergeParams: true });

// List business team members (accessible by all active business members)
router.get(
  '/members',
  requireAuth,
  requireBusinessMember,
  TeamController.listMembers
);

// Invite a team member (accessible by Owner or Manager)
router.post(
  '/invitations',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  TeamController.createInvitation
);

// List pending invitations (Owner or Manager)
router.get(
  '/invitations',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  TeamController.listInvitations
);

// Revoke an invitation (Owner or Manager)
router.delete(
  '/invitations/:invitationId',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  TeamController.revokeInvitation
);

// Update member role or status (restricted to Owner - AUTHZ-007)
router.patch(
  '/members/:memberId',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER),
  TeamController.updateMember
);

// Remove a member (Owner or Manager - AUTHZ-005, AUTHZ-006, TEAM-005)
router.delete(
  '/members/:memberId',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  TeamController.removeMember
);

export default router;
