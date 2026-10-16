import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env';
import { EmailService } from '../services/email.service';

export interface VerificationEmailJobData {
  type?: 'verification';
  email: string;
  name: string;
  token: string;
  code: string;
}

export interface MagicLinkEmailJobData {
  type: 'magic-link';
  email: string;
  token: string;
}

export type EmailJobData = VerificationEmailJobData | MagicLinkEmailJobData;

let redisConnection: Redis | null = null;
let emailQueue: Queue<EmailJobData> | null = null;
let emailWorker: Worker<EmailJobData> | null = null;
let isRedisAvailable = false;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false, // Critical: reject immediately if Redis is not connected so fallback triggers
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) return null; // stop reconnecting if Redis is not started locally
        return Math.min(times * 1000, 3000);
      },
    });

    redisConnection.on('ready', () => {
      isRedisAvailable = true;
      console.log('[BullMQ] Redis connection established and ready.');
    });

    redisConnection.on('error', () => {
      isRedisAvailable = false;
    });

    redisConnection.on('close', () => {
      isRedisAvailable = false;
    });

    redisConnection.on('end', () => {
      isRedisAvailable = false;
    });
  }
  return redisConnection;
}

export function initializeEmailQueue(): void {
  try {
    const connection = getRedisConnection();

    emailQueue = new Queue<EmailJobData>('email-verification-queue', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    emailQueue.on('error', () => {
      // Suppress noisy error emission when Redis is offline in local dev
    });

    emailWorker = new Worker<EmailJobData>(
      'email-verification-queue',
      async (job: Job<EmailJobData>) => {
        if (job.name === 'send-magic-link-email' || (job.data as MagicLinkEmailJobData).type === 'magic-link') {
          const { email, token } = job.data as MagicLinkEmailJobData;
          await EmailService.sendMagicLinkEmail(email, token);
        } else {
          const { email, name, token, code } = job.data as VerificationEmailJobData;
          await EmailService.sendVerificationEmail(email, name, token, code);
        }
      },
      { connection }
    );

    emailWorker.on('error', () => {
      // Suppress noisy error emission when Redis is offline in local dev
    });

    emailWorker.on('failed', (job, err) => {
      console.error(`[BullMQ] Email job ${job?.id} (${job?.name}) failed:`, err);
    });
  } catch (err) {
    console.warn('[BullMQ] Redis queue initialization deferred:', err);
  }
}

/**
 * Enqueues a verification email delivery job.
 * If BullMQ with Redis is available, it is processed via BullMQ.
 * If Redis is offline or unavailable, it automatically falls back to non-blocking
 * background dispatch via setImmediate so verification emails are NEVER lost.
 */
export async function enqueueVerificationEmail(data: VerificationEmailJobData): Promise<void> {
  if (isRedisAvailable && emailQueue) {
    try {
      await emailQueue.add('send-verification-email', { ...data, type: 'verification' });
      return;
    } catch {
      // Redis unavailable or queue error -> proceed to fallback
    }
  }

  // Resilient asynchronous background dispatch
  setImmediate(async () => {
    try {
      await EmailService.sendVerificationEmail(data.email, data.name, data.token, data.code);
    } catch (err) {
      console.error('[EmailQueue] Error sending verification email in fallback mode:', err);
    }
  });
}

/**
 * Enqueues a magic login link email delivery job.
 * Dispatched asynchronously via BullMQ if Redis is running, or resilient background fallback.
 */
export async function enqueueMagicLinkEmail(data: { email: string; token: string }): Promise<void> {
  const jobPayload: MagicLinkEmailJobData = {
    type: 'magic-link',
    email: data.email,
    token: data.token,
  };

  if (isRedisAvailable && emailQueue) {
    try {
      await emailQueue.add('send-magic-link-email', jobPayload);
      return;
    } catch {
      // Redis unavailable or queue error -> proceed to fallback
    }
  }

  // Resilient asynchronous background dispatch
  setImmediate(async () => {
    try {
      await EmailService.sendMagicLinkEmail(data.email, data.token);
    } catch (err) {
      console.error('[EmailQueue] Error sending magic link email in fallback mode:', err);
    }
  });
}
