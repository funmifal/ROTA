import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember, requireBusinessRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { paymentRateLimiter } from '../../middleware/rateLimiter';
import { BillingController } from './billing.controller';
import { checkoutSchema, planChangeSchema } from './billing.validation';
import { MembershipRole } from '@prisma/client';

const router = Router({ mergeParams: true });

// Webhook endpoint (public with server-side signature verification and BullMQ worker)
router.post('/webhook', BillingController.handleWebhook);

// Retrieve active subscription & seat usage (accessible to Owner and Manager)
router.get(
  '/',
  requireAuth,
  requireBusinessMember,
  BillingController.getSubscription
);

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

// Preview proration calculation for changing plan/seats mid-cycle (OWNER only)
router.post(
  '/proration/preview',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER),
  validateBody(planChangeSchema),
  BillingController.previewPlanChange
);

// Apply plan/seat change mid-cycle with deterministic proration (OWNER only)
router.post(
  '/change-plan',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER),
  paymentRateLimiter,
  validateBody(planChangeSchema),
  BillingController.applyPlanChange
);

// View immutable billing ledger & rebuilt state (OWNER only)
router.get(
  '/ledger',
  requireAuth,
  requireBusinessMember,
  requireBusinessRole(MembershipRole.OWNER),
  BillingController.getLedger
);

export default router;
