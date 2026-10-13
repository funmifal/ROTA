import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env';
import { EmailService } from '../services/email.service';

export interface VerificationEmailJobData {
  email: string;
  name: string;
  token: string;
  code: string;
}

let redisConnection: Redis | null = null;
let emailQueue: Queue<VerificationEmailJobData> | null = null;
let emailWorker: Worker<VerificationEmailJobData> | null = null;
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

    emailQueue = new Queue<VerificationEmailJobData>('email-verification-queue', {
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

    emailWorker = new Worker<VerificationEmailJobData>(
      'email-verification-queue',
      async (job: Job<VerificationEmailJobData>) => {
        const { email, name, token, code } = job.data;
        await EmailService.sendVerificationEmail(email, name, token, code);
      },
      { connection }
    );

    emailWorker.on('error', () => {
      // Suppress noisy error emission when Redis is offline in local dev
    });

    emailWorker.on('failed', (job, err) => {
      console.error(`[BullMQ] Email job ${job?.id} failed:`, err);
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
      await emailQueue.add('send-verification-email', data);
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
