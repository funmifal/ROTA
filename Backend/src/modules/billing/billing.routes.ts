import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember, requireBusinessRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { paymentRateLimiter } from '../../middleware/rateLimiter';
import { BillingController } from './billing.controller';
import { checkoutSchema, planChangeSchema } from './billing.validation';
import { MembershipRole, PlanTier } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { config } from '../../config/env';
import { processWebhookEvent } from '../../queues/webhook.queue';

const router = Router({ mergeParams: true });

// Webhook endpoint (public with server-side signature verification and BullMQ worker)
router.post('/webhook', BillingController.handleWebhook);

// Payment redirect callback view (hosted payment return with server-side Flutterwave verification)
router.get('/callback', async (req, res) => {
  const { status, tx_ref, transaction_id } = req.query as Record<string, string>;
  let isSuccess = status === 'successful' || status === 'completed';
  let planName = 'Team';

  try {
    if (tx_ref) {
      const payment = await prisma.payment.findUnique({
        where: { txRef: String(tx_ref) },
      });

      if (payment && config.flutterwave.secretKey && !config.flutterwave.secretKey.includes('your-flutterwave')) {
        const verifyUrl = transaction_id
          ? `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`
          : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`;

        const flwRes = await fetch(verifyUrl, {
          headers: { Authorization: `Bearer ${config.flutterwave.secretKey}` },
        });
        const flwData: any = await flwRes.json();

        if (flwData?.status === 'success' && flwData?.data?.status === 'successful') {
          isSuccess = true;
          const metadata = (payment.metadata as any) || {};
          const plan = (flwData.data.meta?.plan || metadata.plan || 'TEAM') as PlanTier;
          const seats = Number(flwData.data.meta?.seats || metadata.seats || 15);
          planName = plan;

          await processWebhookEvent({
            eventId: String(transaction_id || flwData.data.id || payment.id),
            provider: 'FLUTTERWAVE',
            eventType: 'charge.completed',
            payload: {
              id: flwData.data.id,
              txRef: payment.txRef,
              amountCents: payment.amountCents,
              businessId: payment.businessId,
              plan,
              seats,
              data: flwData.data,
            },
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[BillingCallback] Verification error:', err.message);
  }

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
        <script>
          // Automatically return to the Rota mobile application
          setTimeout(function() {
            window.location.href = 'rota://billing?status=${isSuccess ? 'success' : 'failed'}&plan=${planName}';
          }, 1200);
        </script>
      </head>
      <body>
        <div class="card">
          <div class="badge">${isSuccess ? 'PAYMENT SUCCESSFUL' : 'TRANSACTION COMPLETED'}</div>
          <h2>${isSuccess ? 'Upgrade Activated!' : 'Processing Payment'}</h2>
          <p>${isSuccess ? `Your ${planName} plan has been activated. Returning you to the Rota app...` : 'Your transaction is being confirmed by Flutterwave. You can now return to the Rota app.'}</p>
          ${tx_ref ? `<div class="ref">Reference: ${tx_ref}</div><br>` : ''}
          <a class="btn" href="rota://billing?status=${isSuccess ? 'success' : 'failed'}&plan=${planName}">Return to Rota App</a>
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

// Manually verify latest payment from client
router.post(
  '/verify-latest',
  requireAuth,
  requireBusinessMember,
  BillingController.verifyLatestPayment
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
