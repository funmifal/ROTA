import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env';
import { prisma } from '../database/prisma';
import { LedgerService } from '../modules/billing/ledger.service';
import { LedgerEntryType, PaymentStatus, SubscriptionStatus, PlanTier } from '@prisma/client';

export interface WebhookJobData {
  eventId: string;
  provider: string;
  eventType: string;
  payload: any;
}

let redisConnection: Redis | null = null;
let webhookQueue: Queue<WebhookJobData> | null = null;
let webhookWorker: Worker<WebhookJobData> | null = null;
let isRedisAvailable = false;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 1000, 3000);
      },
    });

    redisConnection.on('ready', () => {
      isRedisAvailable = true;
    });

    redisConnection.on('error', () => {
      isRedisAvailable = false;
    });

    redisConnection.on('close', () => {
      isRedisAvailable = false;
    });
  }
  return redisConnection;
}

/**
 * Handles webhook event processing idempotently.
 */
export async function processWebhookEvent(data: WebhookJobData): Promise<void> {
  const { eventId, provider, eventType, payload } = data;

  // 1. Check idempotency: Ignore if already processed
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { eventId },
  });

  if (existingEvent && existingEvent.status === 'PROCESSED') {
    console.log(`[Webhook] Duplicate event ${eventId} ignored.`);
    return;
  }

  // Record pending event if not recorded
  if (!existingEvent) {
    await prisma.webhookEvent.create({
      data: {
        eventId,
        provider,
        eventType,
        payload,
        status: 'PENDING',
      },
    });
  }

  try {
    // Process payment success or charge events
    if (eventType === 'charge.completed' || eventType === 'successful_payment') {
      const txRef = payload.txRef || payload.data?.tx_ref;
      const amountCents = payload.amountCents || Math.round((payload.data?.amount || 0) * 100);
      const businessId = payload.businessId || payload.data?.meta?.businessId;
      const plan = (payload.plan || payload.data?.meta?.plan || 'STARTER') as PlanTier;
      const seats = Number(payload.seats || payload.data?.meta?.seats || 5);

      if (businessId && txRef) {
        await prisma.$transaction(async (tx) => {
          // Update or create payment record
          await tx.payment.upsert({
            where: { txRef },
            create: {
              txRef,
              businessId,
              amountCents,
              currency: 'USD',
              status: PaymentStatus.SUCCESS,
              providerTxId: String(payload.data?.id || eventId),
              metadata: payload,
            },
            update: {
              status: PaymentStatus.SUCCESS,
              providerTxId: String(payload.data?.id || eventId),
              metadata: payload,
            },
          });

          // Update subscription state
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setDate(periodEnd.getDate() + 30);

          await tx.subscription.upsert({
            where: { businessId },
            create: {
              businessId,
              plan,
              status: SubscriptionStatus.ACTIVE,
              seatsIncluded: plan === 'BUSINESS' ? 40 : plan === 'TEAM' ? 15 : 5,
              extraSeats: Math.max(0, seats - (plan === 'BUSINESS' ? 40 : plan === 'TEAM' ? 15 : 5)),
              totalSeats: seats,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              lastPaymentRef: txRef,
            },
            update: {
              plan,
              status: SubscriptionStatus.ACTIVE,
              totalSeats: seats,
              currentPeriodEnd: periodEnd,
              lastPaymentRef: txRef,
              gracePeriodEnd: null,
            },
          });
        });

        // Record immutable ledger entry
        await LedgerService.recordEntry({
          businessId,
          type: LedgerEntryType.CHARGE,
          amountCents,
          description: `Subscription payment verified via webhook (${plan} plan, ${seats} seats).`,
          referenceId: txRef,
          idempotencyKey: `ledger_pay_${eventId}`,
          metadata: { eventId, txRef, provider },
        });
      }
    } else if (eventType === 'charge.failed' || eventType === 'payment_failed') {
      const businessId = payload.businessId || payload.data?.meta?.businessId;
      const txRef = payload.txRef || payload.data?.tx_ref;

      if (businessId) {
        const graceDays = 7;
        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);

        await prisma.subscription.updateMany({
          where: { businessId },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            gracePeriodEnd,
          },
        });

        if (txRef) {
          await prisma.payment.updateMany({
            where: { txRef },
            data: { status: PaymentStatus.FAILED },
          });
        }

        // Record audit log
        await prisma.auditLog.create({
          data: {
            businessId,
            action: 'PAYMENT_FAILED_GRACE_PERIOD_STARTED',
            resource: 'Subscription',
            metadata: { eventId, txRef, gracePeriodEnd: gracePeriodEnd.toISOString() },
          },
        });
      }
    }

    // Mark event as PROCESSED
    await prisma.webhookEvent.update({
      where: { eventId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  } catch (err: any) {
    await prisma.webhookEvent.update({
      where: { eventId },
      data: {
        status: 'FAILED',
        error: err.message,
      },
    });
    throw err;
  }
}

export function initializeWebhookQueue(): void {
  try {
    const connection = getRedisConnection();

    webhookQueue = new Queue<WebhookJobData>('webhook-processing-queue', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    webhookWorker = new Worker<WebhookJobData>(
      'webhook-processing-queue',
      async (job: Job<WebhookJobData>) => {
        await processWebhookEvent(job.data);
      },
      { connection }
    );

    webhookWorker.on('failed', (job, err) => {
      console.error(`[WebhookQueue] Job ${job?.id} failed:`, err);
    });
  } catch (err) {
    // Non-blocking fallback
  }
}

/**
 * Enqueues a webhook event into BullMQ for asynchronous background processing,
 * with immediate fallback if Redis is unavailable in local dev.
 */
export async function enqueueWebhookEvent(data: WebhookJobData): Promise<void> {
  if (isRedisAvailable && webhookQueue) {
    try {
      await webhookQueue.add('process-webhook', data, {
        jobId: data.eventId,
      });
      return;
    } catch {
      // Fallback to async execution
    }
  }

  // Non-blocking background fallback
  setImmediate(async () => {
    try {
      await processWebhookEvent(data);
    } catch (e) {
      console.error('[Webhook] Fallback processor error:', e);
    }
  });
}
