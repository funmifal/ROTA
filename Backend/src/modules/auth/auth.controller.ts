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

  /**
   * Refreshes access token with rotation and reuse detection.
   */
  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken || typeof refreshToken !== 'string') {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Refresh token is required in request body.',
        });
        return;
      }

      const result = await AuthService.refreshTokens(refreshToken);
      res.status(200).json(result);
    } catch (error: any) {
      const message = error.message || 'Token refresh failed.';
      const statusCode = message.includes('reuse detected') ? 401 : 401;
      res.status(statusCode).json({
        error: 'TokenRefreshError',
        message,
      });
    }
  }

  /**
   * Single-device logout: Revokes the passed refresh token.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.body?.refreshToken;
      const result = await AuthService.logout(refreshToken);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({
        error: 'LogoutError',
        message: error.message || 'Failed to logout.',
      });
    }
  }

  /**
   * Logs out of all devices:
   * Revokes all active refresh tokens and increments user tokenVersion.
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
        return;
      }

      const result = await AuthService.logoutAll(req.user.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({
        error: 'LogoutError',
        message: error.message || 'Failed to log out of all devices.',
      });
    }
  }

  /**
   * Requests a passwordless magic login link.
   */
  static async requestMagicLink(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'ValidationError', message: 'Valid email address is required.' });
        return;
      }

      const result = await AuthService.requestMagicLink(email);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({
        error: 'MagicLinkError',
        message: error.message || 'Failed to process magic link request.',
      });
    }
  }

  /**
   * Verifies a magic login link token.
   */
  static async verifyMagicLink(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'ValidationError', message: 'Magic link token is required.' });
        return;
      }

      const result = await AuthService.verifyMagicLink(token);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        error: 'MagicLinkError',
        message: error.message || 'Invalid or expired magic link.',
      });
    }
  }

  /**
   * Handles GET /magic-login?token=... from magic link email clicks.
   * Renders a responsive web portal that deep-links directly into the Rota mobile app
   * and displays the verification token for manual entry.
   */
  static async renderMagicLoginPage(req: Request, res: Response): Promise<void> {
    const token = (req.query.token as string)?.trim();

    if (!token) {
      if (req.accepts('html')) {
        res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invalid Magic Link - Rota</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .icon { width: 64px; height: 64px; background: #fee2e2; color: #ba1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px; }
    h1 { color: #ba1a1a; font-size: 22px; margin-bottom: 12px; }
    p { color: #526350; font-size: 15px; line-height: 1.5; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>Missing Token</h1>
    <p>This magic login link is missing a verification token. Please request a new login link from the Rota app.</p>
  </div>
</body>
</html>
        `);
        return;
      }
      res.status(400).json({ error: 'ValidationError', message: 'Magic link token is required.' });
      return;
    }

    const deepLinkUrl = `rota://magic-login?token=${encodeURIComponent(token)}`;

    if (req.accepts('html')) {
      res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Log In to Rota</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f6f3; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: white; border-radius: 16px; padding: 40px 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,32,28,0.08); box-sizing: border-box; }
    .logo { width: 60px; height: 60px; background: #e0f2fe; color: #006a60; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 20px; }
    h1 { color: #00201c; font-size: 24px; font-weight: 700; margin: 0 0 10px 0; }
    p { color: #526350; font-size: 15px; line-height: 1.5; margin: 0 0 24px 0; }
    .button { display: inline-block; background-color: #006a60; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; transition: background 0.2s; width: 100%; box-sizing: border-box; }
    .button:hover { background-color: #005048; }
    .token-box { margin: 24px 0 16px 0; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center; }
    .token-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
    .token-code { font-family: monospace; font-size: 14px; font-weight: 700; color: #006a60; word-break: break-all; user-select: all; }
    .copy-btn { margin-top: 10px; background: #e2e8f0; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #334155; cursor: pointer; }
    .copy-btn:hover { background: #cbd5e1; }
    .note { font-size: 12px; color: #94a3b8; margin-top: 20px; }
  </style>
  <script>
    window.onload = function() {
      // Automatically attempt to launch the Rota mobile app
      setTimeout(function() {
        window.location.href = "${deepLinkUrl}";
      }, 300);
    };

    function copyToken() {
      const code = document.getElementById('token-code').innerText;
      navigator.clipboard.writeText(code).then(function() {
        const btn = document.getElementById('copy-btn');
        btn.innerText = 'Copied!';
        setTimeout(function() { btn.innerText = 'Copy Token'; }, 2000);
      });
    }
  </script>
</head>
<body>
  <div class="card">
    <div class="logo">⚡</div>
    <h1>Logging You In...</h1>
    <p>Opening Rota on your device. If the app does not open automatically, click below:</p>
    
    <a href="${deepLinkUrl}" class="button">Open in Rota App</a>

    <div class="token-box">
      <div class="token-label">Or enter this 6-digit login code manually</div>
      <div id="token-code" class="token-code" style="font-size: 28px; letter-spacing: 6px;">${escapeHtml(token)}</div>
      <button id="copy-btn" class="copy-btn" onclick="copyToken()">Copy Code</button>
    </div>

    <div class="note">This single-use magic login link expires in 15 minutes.</div>
  </div>
</body>
</html>
      `);
      return;
    }

    res.status(200).json({ status: 'ok', token, deepLinkUrl });
  }

  /**
   * Requests a password reset email with single-use token.
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'ValidationError', message: 'Valid email address is required.' });
        return;
      }

      const result = await AuthService.forgotPassword(email);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({
        error: 'ForgotPasswordError',
        message: error.message || 'Failed to process password reset request.',
      });
    }
  }

  /**
   * Resets password using single-use expiring token.
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        res.status(400).json({ error: 'ValidationError', message: 'Token and newPassword are required.' });
        return;
      }

      const result = await AuthService.resetPassword(token, newPassword);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        error: 'PasswordResetError',
        message: error.message || 'Password reset failed.',
      });
    }
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
