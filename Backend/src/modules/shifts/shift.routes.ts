import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember, requireBusinessRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { ShiftController } from './shift.controller';
import { createShiftSchema } from './shift.validation';
import { MembershipRole } from '@prisma/client';

const router = Router({ mergeParams: true });

// View upcoming shifts (accessible by all active business members)
router.get(
  '/shifts/upcoming',
  requireAuth,
  requireBusinessMember,
  ShiftController.getUpcomingShifts
);

// Create shift (OWNER and MANAGER only - AUTHZ-005: Staff rejected)
router.post(
  '/shifts',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  validateBody(createShiftSchema),
  ShiftController.createShift
);

// Delete shift (OWNER and MANAGER only - AUTHZ-005: Staff calling directly via Postman rejected with 403)
router.delete(
  '/shifts/:shiftId',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  ShiftController.deleteShift
);

// Seed sample shifts
router.post(
  '/shifts/seed',
  requireAuth,
  requireBusinessMember,
  ShiftController.seedUpcomingShifts
);

export default router;
