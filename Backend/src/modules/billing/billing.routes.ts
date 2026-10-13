import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember, requireBusinessRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { paymentRateLimiter } from '../../middleware/rateLimiter';
import { BillingController } from './billing.controller';
import { checkoutSchema } from './billing.validation';
import { MembershipRole } from '@prisma/client';

const router = Router({ mergeParams: true });

// Initiate subscription checkout (OWNER only - AUTHZ-006, AUTHZ-007; Redis rate-limited; Zod-validated)
router.post(
  '/checkout',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER),
  paymentRateLimiter,
  validateBody(checkoutSchema),
  BillingController.initiateCheckout
);

export default router;
