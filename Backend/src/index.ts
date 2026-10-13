import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/env';
import authRoutes from './modules/auth/auth.routes';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

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
