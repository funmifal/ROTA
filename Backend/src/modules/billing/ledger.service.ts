import { prisma } from '../../database/prisma';
import { LedgerEntryType } from '@prisma/client';

export interface CreateLedgerEntryInput {
  businessId: string;
  subscriptionId?: string;
  type: LedgerEntryType;
  amountCents: number; // positive whole number in cents
  description: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: any;
}

export interface RebuiltLedgerState {
  businessId: string;
  totalChargesCents: number;
  totalCreditsCents: number;
  totalRefundsCents: number;
  totalCorrectionsCents: number;
  netBalanceCents: number;
  entryCount: number;
  entries: Array<{
    id: string;
    type: LedgerEntryType;
    amountCents: number;
    balanceAfterCents: number;
    description: string;
    createdAt: Date;
  }>;
}

export class LedgerService {
  /**
   * Appends an immutable row to the BillingLedger table.
   * Rows in this table are NEVER modified or deleted.
   * Corrections are added as new rows with type 'CORRECTION'.
   */
  static async recordEntry(input: CreateLedgerEntryInput) {
    const {
      businessId,
      subscriptionId,
      type,
      amountCents,
      description,
      referenceId,
      idempotencyKey,
      metadata,
    } = input;

    // Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await prisma.billingLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    // Retrieve previous ledger balance for this business
    const lastEntry = await prisma.billingLedger.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfterCents: true },
    });

    const previousBalance = lastEntry ? lastEntry.balanceAfterCents : 0;

    // CHARGE increases balance due / billed; CREDIT and REFUND decrease balance
    let delta = amountCents;
    if (type === LedgerEntryType.CREDIT || type === LedgerEntryType.REFUND) {
      delta = -amountCents;
    } else if (type === LedgerEntryType.CORRECTION) {
      // Delta can be positive or negative based on metadata if provided, otherwise delta = amountCents
      delta = metadata?.deltaCents !== undefined ? Number(metadata.deltaCents) : amountCents;
    }

    const balanceAfterCents = previousBalance + delta;

    return await prisma.billingLedger.create({
      data: {
        businessId,
        subscriptionId,
        type,
        amountCents,
        balanceAfterCents,
        description,
        referenceId,
        idempotencyKey,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Rebuilds and audits the entire subscription financial state strictly from immutable ledger rows.
   */
  static async rebuildSubscriptionStateFromLedger(businessId: string): Promise<RebuiltLedgerState> {
    const entries = await prisma.billingLedger.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });

    let totalChargesCents = 0;
    let totalCreditsCents = 0;
    let totalRefundsCents = 0;
    let totalCorrectionsCents = 0;
    let runningBalance = 0;

    for (const entry of entries) {
      if (entry.type === LedgerEntryType.CHARGE) {
        totalChargesCents += entry.amountCents;
        runningBalance += entry.amountCents;
      } else if (entry.type === LedgerEntryType.CREDIT) {
        totalCreditsCents += entry.amountCents;
        runningBalance -= entry.amountCents;
      } else if (entry.type === LedgerEntryType.REFUND) {
        totalRefundsCents += entry.amountCents;
        runningBalance -= entry.amountCents;
      } else if (entry.type === LedgerEntryType.CORRECTION) {
        const delta = (entry.metadata as any)?.deltaCents !== undefined
          ? Number((entry.metadata as any).deltaCents)
          : entry.amountCents;
        totalCorrectionsCents += delta;
        runningBalance += delta;
      }
    }

    return {
      businessId,
      totalChargesCents,
      totalCreditsCents,
      totalRefundsCents,
      totalCorrectionsCents,
      netBalanceCents: runningBalance,
      entryCount: entries.length,
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amountCents: e.amountCents,
        balanceAfterCents: e.balanceAfterCents,
        description: e.description,
        createdAt: e.createdAt,
      })),
    };
  }
}
