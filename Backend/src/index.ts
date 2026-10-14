import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import { initializeEmailQueue } from './queues/email.queue';
import { initializeWebhookQueue } from './queues/webhook.queue';
import { initializePushNotificationQueue } from './queues/notification.queue';

const app = express();

// Initialize BullMQ background queues & workers
initializeEmailQueue();
initializeWebhookQueue();
initializePushNotificationQueue();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// Task A: Read and Write routing with Read-Your-Own-Writes consistency
import { readYourOwnWritesMiddleware } from './database/dbRouter';
app.use(readYourOwnWritesMiddleware);

// Security middleware: Passwords must NEVER be transmitted in URLs or query parameters
app.use((req: Request, res: Response, next) => {
  if (req.query && ('password' in req.query || 'pass' in req.query || 'pwd' in req.query)) {
    return res.status(400).json({
      error: 'SecurityViolation',
      message: 'Passwords must never be transmitted in a URL or query string.',
    });
  }
  next();
});

// Health route (required by Checkpoint 2)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'rota-backend',
  });
});

// Auth module routes
app.use('/api/auth', authRoutes);

// Business and Team routes
import businessRoutes from './modules/businesses/business.routes';
import teamRoutes from './modules/team/team.routes';
import invitationRoutes from './modules/team/invitation.routes';
import activityRoutes from './modules/activity/activity.routes';
import settingsRoutes from './modules/settings/settings.routes';
import shiftRoutes from './modules/shifts/shift.routes';
import swapRoutes from './modules/swaps/swap.routes';
import billingRoutes from './modules/billing/billing.routes';

app.use('/api/users/settings', settingsRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/businesses/:businessId', teamRoutes);
app.use('/api/businesses/:businessId', activityRoutes);
app.use('/api/businesses/:businessId', shiftRoutes);
app.use('/api/businesses/:businessId', swapRoutes);
app.use('/api/businesses/:businessId/billing', billingRoutes);
app.use('/api/businesses/:businessId/subscription', billingRoutes);
import { BillingController } from './modules/billing/billing.controller';
import notificationRoutes from './modules/notifications/notification.routes';
app.use('/api/invitations', invitationRoutes);
app.post('/api/billing/webhook', BillingController.handleWebhook);
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);

// Protected dashboard route (required by Checkpoint 2: "Add a protected route the dashboard can call.")
import { requireAuth } from './middleware/auth';
app.get('/api/dashboard/summary', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to Rota Dashboard',
    user: req.user,
    overview: {
      businessesCount: 0,
      upcomingShiftsCount: 0,
      pendingSwapsCount: 0,
    },
  });
});

const PORT = config.port;
// Bind to 0.0.0.0 so Expo client on LAN can reach the backend
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Rota Backend] Server running on http://0.0.0.0:${PORT}`);
});

export { app, server };
