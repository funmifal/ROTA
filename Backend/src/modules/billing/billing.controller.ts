import { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { LedgerService } from './ledger.service';
import { enqueueWebhookEvent, processWebhookEvent } from '../../queues/webhook.queue';
import { prisma } from '../../database/prisma';
import { config } from '../../config/env';
import { PaymentStatus, PlanTier } from '@prisma/client';

export class BillingController {
  /**
   * Initiates payment checkout in test mode with idempotency key.
   */
  static async initiateCheckout(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const user = req.user!;
      const { planId, seats } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

      const result = await BillingService.initiateCheckout(
        membership.businessId,
        user.id,
        user.email,
        planId,
        seats,
        idempotencyKey
      );

      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to initiate checkout: ' + err.message,
      });
    }
  }

  /**
   * Previews proration for mid-cycle plan or seat changes.
   */
  static async previewPlanChange(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const { newPlan, newSeats } = req.body;

      const preview = await BillingService.previewPlanChange(
        membership.businessId,
        newPlan,
        Number(newSeats)
      );

      res.status(200).json(preview);
    } catch (err: any) {
      res.status(400).json({
        error: 'ProrationError',
        message: err.message || 'Failed to calculate proration preview.',
      });
    }
  }

  /**
   * Applies mid-cycle plan or seat change with deterministic proration and immutable ledger.
   */
  static async applyPlanChange(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const { newPlan, newSeats } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

      const result = await BillingService.applyPlanChange(
        membership.businessId,
        newPlan,
        Number(newSeats),
        idempotencyKey
      );

      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({
        error: 'PlanChangeError',
        message: err.message || 'Failed to apply plan change.',
      });
    }
  }

  /**
   * Retrieves active subscription, seat usage, and limits.
   */
  static async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const businessId = membership.businessId;

      let subscription = await prisma.subscription.findUnique({
        where: { businessId },
      });

      const activeMembersCount = await prisma.membership.count({
        where: { businessId, status: 'ACTIVE' },
      });

      const pendingInvitesCount = await prisma.invitation.count({
        where: { businessId, status: 'PENDING', expiresAt: { gt: new Date() } },
      });

      res.status(200).json({
        subscription: subscription || {
          plan: 'STARTER',
          status: 'ACTIVE',
          totalSeats: 5,
          seatsIncluded: 5,
        },
        seatUsage: {
          activeMembers: activeMembersCount,
          pendingInvites: pendingInvitesCount,
          totalAllocated: activeMembersCount + pendingInvitesCount,
          totalAvailable: subscription ? subscription.totalSeats : 5,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve subscription: ' + err.message,
      });
    }
  }

  /**
   * Returns immutable billing ledger entries and verifies rebuilt state.
   */
  static async getLedger(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const rebuiltState = await LedgerService.rebuildSubscriptionStateFromLedger(membership.businessId);

      res.status(200).json({
        ledger: rebuiltState,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve billing ledger: ' + err.message,
      });
    }
  }

  /**
   * Webhook endpoint:
   * - Verifies webhook signature against secret hash.
   * - Offloads to BullMQ background queue for asynchronous, idempotent processing.
   * - The app never decides if a payment succeeded; the server decides based on verified webhook.
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['verif-hash'];
      const secretHash = process.env.FLW_SECRET_HASH || 'rota-test-secret-hash';

      if (!signature || signature !== secretHash) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid webhook signature.',
        });
        return;
      }

      const body = req.body;
      const eventId = String(body.id || body.data?.id || body.txRef || body.data?.tx_ref || `evt_${Date.now()}`);
      const eventType = body['event.type'] || body.event || body.eventType || 'charge.completed';

      // Enqueue into BullMQ background worker
      await enqueueWebhookEvent({
        eventId,
        provider: 'FLUTTERWAVE',
        eventType,
        payload: body,
      });

      res.status(200).json({
        status: 'queued',
        eventId,
        message: 'Webhook received and enqueued for asynchronous processing.',
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'WebhookError',
        message: 'Failed to handle webhook: ' + err.message,
      });
    }
  }

  /**
   * Verifies pending transaction with Flutterwave API and activates subscription.
   */
  static async verifyLatestPayment(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const businessId = membership.businessId;

      // Find the latest pending payment for this business
      const latestPayment = await prisma.payment.findFirst({
        where: { businessId, status: PaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
      });

      if (!latestPayment) {
        const sub = await prisma.subscription.findUnique({ where: { businessId } });
        res.status(200).json({
          verified: false,
          message: 'No pending payments found.',
          subscription: sub,
        });
        return;
      }

      // Verify with Flutterwave
      let isVerified = false;
      let flwData: any = null;

      if (config.flutterwave.secretKey && !config.flutterwave.secretKey.includes('your-flutterwave')) {
        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${latestPayment.txRef}`,
          {
            headers: { Authorization: `Bearer ${config.flutterwave.secretKey}` },
          }
        );
        flwData = await flwRes.json();
        if (flwData?.status === 'success' && flwData?.data?.status === 'successful') {
          isVerified = true;
        }
      }

      if (isVerified && flwData?.data) {
        const metadata = (latestPayment.metadata as any) || {};
        const plan = (flwData.data.meta?.plan || metadata.plan || 'TEAM') as PlanTier;
        const seats = Number(flwData.data.meta?.seats || metadata.seats || 15);
        const amountCents = latestPayment.amountCents;

        await processWebhookEvent({
          eventId: String(flwData.data.id || latestPayment.id),
          provider: 'FLUTTERWAVE',
          eventType: 'charge.completed',
          payload: {
            id: flwData.data.id,
            txRef: latestPayment.txRef,
            amountCents,
            businessId,
            plan,
            seats,
            data: flwData.data,
          },
        });

        const updatedSub = await prisma.subscription.findUnique({ where: { businessId } });

        res.status(200).json({
          verified: true,
          message: `Payment successfully verified. Upgraded to ${plan} Plan!`,
          subscription: updatedSub,
        });
        return;
      }

      res.status(200).json({
        verified: false,
        message: 'Payment has not been confirmed yet by Flutterwave.',
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'VerificationError',
        message: 'Failed to verify payment: ' + err.message,
      });
    }
  }
}

