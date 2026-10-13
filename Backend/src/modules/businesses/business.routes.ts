import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember, requireBusinessRole } from '../../middleware/rbac';
import { BusinessController } from './business.controller';
import { MembershipRole } from '@prisma/client';

const router = Router();

// Create business (authenticated user)
router.post('/', requireAuth, BusinessController.create);

// List businesses for authenticated user
router.get('/', requireAuth, BusinessController.list);

// Get business details (requires membership)
router.get('/:businessId', requireAuth, requireBusinessMember, BusinessController.getById);

// Update business details (requires OWNER role - AUTHZ-007)
router.patch(
  '/:businessId',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER),
  BusinessController.update
);

export default router;
