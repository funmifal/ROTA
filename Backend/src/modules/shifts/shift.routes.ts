import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember } from '../../middleware/rbac';
import { ShiftController } from './shift.controller';

const router = Router({ mergeParams: true });

router.get(
  '/shifts/upcoming',
  requireAuth,
  requireBusinessMember,
  ShiftController.getUpcomingShifts
);

router.post(
  '/shifts/seed',
  requireAuth,
  requireBusinessMember,
  ShiftController.seedUpcomingShifts
);

export default router;
