import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { loginRateLimiter, passwordResetRateLimiter } from '../../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  magicLinkSchema,
  verifyMagicLinkSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyCodeSchema,
  resendVerificationSchema,
} from './auth.validation';

const router = Router();

// Primary Authentication
router.post('/register', validateBody(registerSchema), AuthController.register);
router.post('/login', loginRateLimiter, validateBody(loginSchema), AuthController.login);
router.post('/refresh', validateBody(refreshSchema), AuthController.refresh);
router.post('/logout', validateBody(logoutSchema), AuthController.logout);
router.post('/logout-all', requireAuth, AuthController.logoutAll);

// Passwordless Magic Link
router.post('/magic-link', loginRateLimiter, validateBody(magicLinkSchema), AuthController.requestMagicLink);
router.post('/magic-link/verify', validateBody(verifyMagicLinkSchema), AuthController.verifyMagicLink);
router.get('/magic-login', AuthController.renderMagicLoginPage);

// Password Reset (Single-use, expiring token)
router.post('/forgot-password', passwordResetRateLimiter, validateBody(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', passwordResetRateLimiter, validateBody(resetPasswordSchema), AuthController.resetPassword);

// Profile & Verification
router.get('/me', requireAuth, AuthController.getMe);
router.get('/verify-email', AuthController.verifyEmail);
router.post('/verify-code', validateBody(verifyCodeSchema), AuthController.verifyCode);
router.post('/resend-verification', passwordResetRateLimiter, validateBody(resendVerificationSchema), AuthController.resendVerification);

export default router;
