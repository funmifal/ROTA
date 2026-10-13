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

function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) return null; // stop reconnecting if Redis is not running locally
        return Math.min(times * 500, 2000);
      },
    });

    redisConnection.on('error', (err) => {
      // Suppress noisy uncaught errors if Redis is not started in local dev
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

    emailQueue.on('error', (err) => {
      // Suppress unhandled error emission when Redis is offline in local development
    });

    emailWorker = new Worker<VerificationEmailJobData>(
      'email-verification-queue',
      async (job: Job<VerificationEmailJobData>) => {
        const { email, name, token, code } = job.data;
        await EmailService.sendVerificationEmail(email, name, token, code);
      },
      { connection }
    );

    emailWorker.on('error', (err) => {
      // Suppress unhandled error emission when Redis is offline in local development
    });

    emailWorker.on('failed', (job, err) => {
      // Failed job logged
    });
  } catch (err) {
    // If Redis is unavailable, worker initialization will defer gracefully
  }
}

/**
 * Enqueues a verification email delivery job into the BullMQ background queue.
 * If Redis is unavailable, processes asynchronously via background promise.
 */
export async function enqueueVerificationEmail(data: VerificationEmailJobData): Promise<void> {
  if (emailQueue) {
    try {
      await emailQueue.add('send-verification-email', data);
      return;
    } catch {
      // Fallback to asynchronous execution if Redis connection fails
    }
  }

  // Graceful asynchronous dispatch without blocking HTTP response
  setImmediate(async () => {
    try {
      await EmailService.sendVerificationEmail(data.email, data.name, data.token, data.code);
    } catch {
      // Suppress unhandled error
    }
  });
}
