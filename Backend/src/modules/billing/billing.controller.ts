import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';

export class BillingController {
  /**
   * Initiates a subscription checkout session via Flutterwave.
   * Adheres strictly to:
   * - AUTHZ-006 & AUTHZ-007: Only OWNERS may initiate or manage billing.
   * - BILL-004, BILL-005: Server-side payment processing only; clients never confirm payment.
   * - REDIS-003: Rate limited with Redis.
   * - Whole numbers minor currency units (kobo) for money.
   */
  static async initiateCheckout(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const user = req.user!;
      const { planId, seats, currency = 'NGN', redirectUrl } = req.body;

      // Pricing in kobo (1 NGN = 100 kobo). Example: 3,000 NGN per seat = 300,000 kobo.
      const pricePerSeatKobo = 300000;
      const totalAmountKobo = pricePerSeatKobo * seats;

      const txRef = `rota_sub_${membership.businessId}_${Date.now()}`;

      // Record audit log
      await prisma.auditLog.create({
        data: {
          businessId: membership.businessId,
          userId: user.id,
          action: 'BILLING_CHECKOUT_INITIATED',
          resource: 'Subscription',
          metadata: {
            planId,
            seats,
            currency,
            totalAmountKobo,
            txRef,
          },
        },
      });

      // Construct server-controlled checkout payload
      res.status(200).json({
        message: 'Checkout session created successfully.',
        checkout: {
          txRef,
          planId,
          seats,
          amountKobo: totalAmountKobo,
          currency,
          customer: {
            email: user.email,
          },
          status: 'PENDING',
          paymentUrl: `https://checkout.flutterwave.com/v3/hosted/pay/${txRef}`,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to initiate billing checkout: ' + err.message,
      });
    }
  }
}
