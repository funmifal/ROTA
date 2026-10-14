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

// Payment redirect callback view (hosted payment return)
router.get('/callback', (req, res) => {
  const { status, tx_ref } = req.query;
  const isSuccess = status === 'successful' || status === 'completed';
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Status - Rota</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f6fbf8; color: #191d1c; }
          .card { background: white; padding: 36px 28px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; max-width: 420px; width: 90%; }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 12px; font-weight: 700; font-size: 12px; margin-bottom: 16px; background-color: ${isSuccess ? '#a2f6b0' : '#ffdad6'}; color: ${isSuccess ? '#00210b' : '#ba1a1a'}; }
          h2 { margin: 0 0 10px 0; color: #2f6b5f; font-size: 24px; }
          p { color: #566062; font-size: 14px; line-height: 20px; margin: 0 0 24px 0; }
          .ref { font-family: monospace; font-size: 11px; background: #eaf0ed; padding: 6px 10px; border-radius: 6px; display: inline-block; margin-bottom: 20px; word-break: break-all; }
          .btn { display: inline-block; background-color: #2f6b5f; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${isSuccess ? 'PAYMENT SUCCESSFUL' : 'TRANSACTION COMPLETED'}</div>
          <h2>${isSuccess ? 'Upgrade Successful!' : 'Processing Payment'}</h2>
          <p>Your subscription is being activated via Flutterwave. You can now return to the Rota app.</p>
          ${tx_ref ? `<div class="ref">Reference: ${tx_ref}</div><br>` : ''}
          <a class="btn" href="rota://billing">Return to Rota App</a>
        </div>
      </body>
    </html>
  `);
});

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
