import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env';
import { prisma } from '../database/prisma';
import { NotificationService } from '../modules/notifications/notification.service';
import { NotificationType, PushNotificationPayload } from '../modules/notifications/notification.types';

let redisConnection: Redis | null = null;
let pushQueue: Queue<PushNotificationPayload> | null = null;
let pushWorker: Worker<PushNotificationPayload> | null = null;
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
 * Sends push notifications to an external provider (Expo Push API) and handles receipts.
 */
async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ invalidTokens: string[]; successCount: number }> {
  const invalidTokens: string[] = [];
  let successCount = 0;

  if (tokens.length === 0) {
    return { invalidTokens, successCount };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: data || {},
  }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await res.json() as any;
    const tickets = result?.data || [];

    // Analyze ticket results for device unregistration / invalid tokens
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = tokens[i];

      if (ticket.status === 'ok') {
        successCount++;
      } else if (ticket.status === 'error') {
        const errorCode = ticket.details?.error;
        console.warn(`[PushService] Error delivering to token ${token}:`, errorCode);
        if (errorCode === 'DeviceNotRegistered' || errorCode === 'InvalidCredentials') {
          invalidTokens.push(token);
        }
      }
    }
  } catch (err: any) {
    console.warn('[PushService] Expo Push API error:', err.message);
  }

  return { invalidTokens, successCount };
}

/**
 * Asynchronously processes push notification fan-out, category checks, quiet hours, and invalid token cleanup.
 */
export async function processPushNotification(payload: PushNotificationPayload): Promise<void> {
  const { userId, type, title, body, data } = payload;

  // 1. If not a delayed retry run, record in-app notification in database with deep linking data
  if (!payload.isDelayedRun) {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data || {},
      },
    });
  }

  // 2. Evaluate user delivery settings & quiet hours
  if (!payload.isDelayedRun) {
    const check = await NotificationService.shouldDeliverPushNotification(
      userId,
      type,
      payload.isUrgent
    );

    if (check.delayed && check.delayMs) {
      console.log(
        `[PushService] Quiet hours active for user ${userId}. Non-urgent notification delayed by ${Math.round(
          check.delayMs / 60000
        )}m.`
      );

      const delayedPayload = { ...payload, isDelayedRun: true };
      if (isRedisAvailable && pushQueue) {
        try {
          await pushQueue.add('send-push', delayedPayload, { delay: check.delayMs });
          return;
        } catch {
          // Fall through to setTimeout
        }
      }

      // Safe fallback timer for delayed execution
      setTimeout(async () => {
        try {
          await processPushNotification(delayedPayload);
        } catch (err) {
          console.error('[PushQueue] Delayed notification delivery error:', err);
        }
      }, check.delayMs);
      return;
    }

    if (!check.deliver) {
      console.log(`[PushService] Push suppressed for user ${userId} (${type}): ${check.reason}`);
      return;
    }
  }

  // 3. Retrieve all active registered devices for this user
  const devices = await prisma.deviceToken.findMany({
    where: {
      userId,
      isActive: true,
    },
  });

  if (devices.length === 0) {
    return;
  }

  const tokens = devices.map((d) => d.pushToken);

  // 4. Send to Expo Push API
  const { invalidTokens, successCount } = await sendExpoPushNotifications(
    tokens,
    title,
    body,
    data
  );

  // 5. Purge any invalid tokens reported by the push service
  if (invalidTokens.length > 0) {
    await NotificationService.removeInvalidPushTokens(invalidTokens);
  }

  console.log(`[PushService] Dispatched push for user ${userId} (${successCount} sent, ${invalidTokens.length} pruned).`);
}

export function initializePushNotificationQueue(): void {
  try {
    const connection = getRedisConnection();

    pushQueue = new Queue<PushNotificationPayload>('push-notification-queue', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    pushWorker = new Worker<PushNotificationPayload>(
      'push-notification-queue',
      async (job: Job<PushNotificationPayload>) => {
        await processPushNotification(job.data);
      },
      { connection }
    );

    pushWorker.on('failed', (job, err) => {
      console.error(`[PushQueue] Job ${job?.id} failed:`, err);
    });
  } catch (err) {
    // Graceful fallback
  }
}

/**
 * Enqueues a notification into BullMQ for asynchronous background delivery.
 * Never executes network I/O synchronously inside the HTTP handler.
 */
export async function enqueuePushNotification(payload: PushNotificationPayload): Promise<void> {
  if (isRedisAvailable && pushQueue) {
    try {
      await pushQueue.add('send-push', payload);
      return;
    } catch {
      // Fall through to immediate background dispatch
    }
  }

  // Non-blocking async background fallback
  setImmediate(async () => {
    try {
      await processPushNotification(payload);
    } catch (err) {
      console.error('[PushQueue] Fallback worker error:', err);
    }
  });
}
