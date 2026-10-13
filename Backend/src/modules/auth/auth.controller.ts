import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.validation';
import { ZodError } from 'zod';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await AuthService.register(validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: error.errors[0]?.message || 'Invalid input data',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      const message = error instanceof Error ? error.message : 'Registration failed.';
      const statusCode = message.includes('already exists') ? 409 : 500;
      res.status(statusCode).json({ error: 'RegistrationError', message });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await AuthService.login(validatedData);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: error.errors[0]?.message || 'Invalid credentials input',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      const message = error instanceof Error ? error.message : 'Login failed.';
      const statusCode = message.includes('Invalid email or password') ? 401 : 500;
      res.status(statusCode).json({ error: 'AuthenticationError', message });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    // In JWT architecture, client drops token; endpoint confirms session termination safely
    res.status(200).json({
      message: 'Logged out successfully.',
    });
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
        return;
      }

      const user = await AuthService.getProfile(req.user.id);
      res.status(200).json({ user });
    } catch (error) {
      res.status(404).json({
        error: 'NotFoundError',
        message: 'User profile not found.',
      });
    }
  }

  static async verifyEmail(req: Request, res: Response): Promise<void> {
    const token = (req.query.token as string)?.trim();

    try {
      if (!token) {
        throw new Error('Verification token is missing.');
      }

      const result = await AuthService.verifyEmail(token);

      // If requested by a web browser, render a clean branded confirmation page
      if (req.accepts('html')) {
        res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Email Verified - Rota</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f6f3; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 460px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .icon { width: 64px; height: 64px; background: #e0f2fe; color: #006a60; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px; }
    h1 { color: #00201c; font-size: 24px; margin-bottom: 12px; }
    p { color: #526350; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-weight: 600; padding: 6px 16px; border-radius: 20px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Email Verified!</h1>
    <p>Your email <strong>${escapeHtml(result.email)}</strong> has been verified successfully. Your Rota account is now active.</p>
    <div class="badge">One-Time Link Used</div>
  </div>
</body>
</html>
        `);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed.';

      if (req.accepts('html')) {
        res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verification Error - Rota</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 460px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .icon { width: 64px; height: 64px; background: #fee2e2; color: #ba1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px; }
    h1 { color: #ba1a1a; font-size: 22px; margin-bottom: 12px; }
    p { color: #526350; font-size: 15px; line-height: 1.5; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>Verification Failed</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>
        `);
        return;
      }

      res.status(400).json({ error: 'VerificationError', message });
    }
  }

  static async verifyCode(req: Request, res: Response): Promise<void> {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        res.status(400).json({ error: 'ValidationError', message: 'Email address and verification code are required.' });
        return;
      }

      const result = await AuthService.verifyCode(email, code);
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed.';
      res.status(400).json({ error: 'VerificationError', message });
    }
  }

  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'ValidationError', message: 'A valid email address is required.' });
        return;
      }

      const result = await AuthService.resendVerification(email);
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend verification email.';
      res.status(500).json({ error: 'InternalServerError', message });
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

