import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember, requireBusinessRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { BusinessController } from './business.controller';
import { createBusinessSchema, updateBusinessSchema } from './business.validation';
import { MembershipRole } from '@prisma/client';

const router = Router();

// Create business (authenticated user, validated with Zod)
router.post('/', requireAuth, validateBody(createBusinessSchema), BusinessController.create);

// List businesses for authenticated user
router.get('/', requireAuth, BusinessController.list);

// Get business details (requires membership)
router.get('/:businessId', requireAuth, requireBusinessMember, BusinessController.getById);

// Update business details (requires OWNER role - AUTHZ-007, validated with Zod)
router.patch(
  '/:businessId',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER),
  validateBody(updateBusinessSchema),
  BusinessController.update
);

export default router;
