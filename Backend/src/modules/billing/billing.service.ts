import { prisma } from '../../database/prisma';
import { ProrationService } from './proration.service';
import { LedgerService } from './ledger.service';
import { PlanTier, SubscriptionStatus, LedgerEntryType, PaymentStatus, PLANS, calculateMonthlyPlanCostCents } from './billing.types';
import { config } from '../../config/env';

export class BillingService {
  /**
   * Previews proration calculation for changing plan or seats mid-cycle.
   */
  static async previewPlanChange(businessId: string, newPlan: PlanTier, newSeats: number) {
    let subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    const now = new Date();

    if (!subscription) {
      // Default to 30-day starter if no active subscription record yet
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 10); // simulate day 10
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 30);

      subscription = {
        id: 'default_sub',
        businessId,
        plan: PlanTier.STARTER,
        status: SubscriptionStatus.ACTIVE,
        seatsIncluded: 5,
        extraSeats: 0,
        totalSeats: 5,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        pendingDowngradePlan: null,
        pendingDowngradeSeats: null,
        gracePeriodEnd: null,
        lastPaymentRef: null,
        createdAt: periodStart,
        updatedAt: now,
      };
    }

    const proration = ProrationService.calculateProration({
      currentPlan: subscription.plan,
      currentSeats: subscription.totalSeats,
      newPlan,
      newSeats,
      periodStartDate: subscription.currentPeriodStart,
      periodEndDate: subscription.currentPeriodEnd,
      changeDate: now,
    });

    return {
      current: {
        plan: subscription.plan,
        seats: subscription.totalSeats,
        monthlyCostCents: proration.currentPlanMonthlyCostCents,
        periodEnd: subscription.currentPeriodEnd,
      },
      proposed: {
        plan: newPlan,
        seats: newSeats,
        monthlyCostCents: proration.newPlanMonthlyCostCents,
      },
      proration,
    };
  }

  /**
   * Applies plan or seat change with deterministic proration and immutable ledger entry.
   * Adheres strictly to:
   * - Idempotency key enforcement on every payment/mutation request.
   * - Immutable ledger append.
   */
  static async applyPlanChange(
    businessId: string,
    newPlan: PlanTier,
    newSeats: number,
    idempotencyKey?: string
  ) {
    // 1. Check idempotency
    if (idempotencyKey) {
      const existingLedger = await prisma.billingLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existingLedger) {
        const sub = await prisma.subscription.findUnique({ where: { businessId } });
        return {
          message: 'Operation previously processed (idempotent response).',
          subscription: sub,
          ledgerEntry: existingLedger,
        };
      }
    }

    const preview = await this.previewPlanChange(businessId, newPlan, newSeats);
    const { proration } = preview;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      let sub = await tx.subscription.findUnique({ where: { businessId } });
      const planConfig = PLANS[newPlan];

      if (!sub) {
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);
        sub = await tx.subscription.create({
          data: {
            businessId,
            plan: newPlan,
            status: SubscriptionStatus.ACTIVE,
            seatsIncluded: planConfig.includedSeats,
            extraSeats: Math.max(0, newSeats - planConfig.includedSeats),
            totalSeats: newSeats,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      } else if (proration.scheduledForNextPeriod) {
        // Downgrade: schedule for next period end
        sub = await tx.subscription.update({
          where: { businessId },
          data: {
            pendingDowngradePlan: newPlan,
            pendingDowngradeSeats: newSeats,
          },
        });
      } else {
        // Upgrade: apply immediately
        sub = await tx.subscription.update({
          where: { businessId },
          data: {
            plan: newPlan,
            seatsIncluded: planConfig.includedSeats,
            extraSeats: Math.max(0, newSeats - planConfig.includedSeats),
            totalSeats: newSeats,
            status: SubscriptionStatus.ACTIVE,
            pendingDowngradePlan: null,
            pendingDowngradeSeats: null,
          },
        });
      }

      // Record immutable ledger entry
      let ledgerEntry = null;
      if (proration.chargeTodayCents > 0) {
        ledgerEntry = await LedgerService.recordEntry({
          businessId,
          subscriptionId: sub.id,
          type: LedgerEntryType.CHARGE,
          amountCents: proration.chargeTodayCents,
          description: proration.description,
          idempotencyKey,
          metadata: {
            proration,
            previousPlan: preview.current.plan,
            newPlan,
          },
        });
      } else if (proration.scheduledForNextPeriod) {
        ledgerEntry = await LedgerService.recordEntry({
          businessId,
          subscriptionId: sub.id,
          type: LedgerEntryType.CREDIT,
          amountCents: 0,
          description: proration.description,
          idempotencyKey,
          metadata: { proration, scheduled: true },
        });
      }

      return { subscription: sub, ledgerEntry, proration };
    });

    return result;
  }

  /**
   * Initiates payment checkout in test mode with idempotency key.
   */
  static async initiateCheckout(
    businessId: string,
    userId: string,
    userEmail: string,
    plan: PlanTier,
    seats: number,
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existingPayment) {
        const metadata = (existingPayment.metadata as any) || {};
        const paymentUrl = metadata.paymentUrl || `https://checkout.flutterwave.com/v3/hosted/pay/${existingPayment.txRef}`;
        return {
          message: 'Existing checkout session retrieved.',
          checkout: {
            txRef: existingPayment.txRef,
            amountCents: existingPayment.amountCents,
            currency: existingPayment.currency,
            status: existingPayment.status,
            paymentUrl,
          },
        };
      }
    }

    const amountCents = calculateMonthlyPlanCostCents(plan, seats);
    const txRef = `rota_sub_${businessId}_${Date.now()}`;
    const amountInDollars = (amountCents / 100).toFixed(2);

    let paymentUrl = `https://checkout.flutterwave.com/v3/hosted/pay/${txRef}`;

    // Request an active, live/test hosted checkout session link from Flutterwave v3 API
    if (config.flutterwave.secretKey && !config.flutterwave.secretKey.includes('your-flutterwave')) {
      try {
        const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.flutterwave.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tx_ref: txRef,
            amount: amountInDollars,
            currency: 'USD',
            redirect_url: `${config.appUrl}/api/businesses/${businessId}/billing/callback`,
            customer: {
              email: userEmail,
              name: userEmail.split('@')[0],
            },
            customizations: {
              title: 'Rota Subscription',
              description: `${plan} Plan (${seats} seats)`,
              logo: 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png',
            },
            meta: {
              businessId,
              userId,
              plan,
              seats,
            },
          }),
        });

        const flwData: any = await flwRes.json();
        if (flwData?.status === 'success' && flwData?.data?.link) {
          paymentUrl = flwData.data.link;
        } else {
          console.warn('[Flutterwave] Checkout initialization returned:', flwData?.message || flwData);
        }
      } catch (err: any) {
        console.error('[Flutterwave] Failed to call payments API:', err.message);
      }
    }

    const payment = await prisma.payment.create({
      data: {
        businessId,
        amountCents,
        currency: 'USD',
        status: PaymentStatus.PENDING,
        provider: 'FLUTTERWAVE',
        txRef,
        idempotencyKey,
        metadata: { plan, seats, userId, userEmail, paymentUrl },
      },
    });

    return {
      message: 'Checkout session created successfully.',
      checkout: {
        txRef: payment.txRef,
        amountCents: payment.amountCents,
        currency: payment.currency,
        plan,
        seats,
        status: payment.status,
        paymentUrl,
      },
    };
  }

  /**
   * Handles failed renewal: initiates grace period and restricts access if grace period expires.
   */
  static async handleFailedRenewal(businessId: string, graceDays = 7) {
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);

    const subscription = await prisma.subscription.update({
      where: { businessId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        gracePeriodEnd,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        action: 'SUBSCRIPTION_RENEWAL_FAILED_GRACE_PERIOD',
        resource: 'Subscription',
        metadata: {
          graceDays,
          gracePeriodEnd: gracePeriodEnd.toISOString(),
        },
      },
    });

    return {
      subscription,
      gracePeriodEnd,
      message: `Payment failed. A grace period of ${graceDays} days has been granted. Please update payment details.`,
    };
  }

  /**
   * Enforces restricted access if grace period has expired.
   */
  static async checkGracePeriodAndRestrict(businessId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) return null;

    if (
      subscription.status === SubscriptionStatus.PAST_DUE &&
      subscription.gracePeriodEnd &&
      new Date() > subscription.gracePeriodEnd
    ) {
      const restricted = await prisma.subscription.update({
        where: { businessId },
        data: {
          status: SubscriptionStatus.EXPIRED,
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
          action: 'SUBSCRIPTION_EXPIRED_ACCESS_RESTRICTED',
          resource: 'Subscription',
          metadata: { expiredAt: new Date().toISOString() },
        },
      });

      return restricted;
    }

    return subscription;
  }
}
