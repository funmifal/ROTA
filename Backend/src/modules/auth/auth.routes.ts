import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Primary Authentication
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/logout-all', requireAuth, AuthController.logoutAll);

// Passwordless Magic Link
router.post('/magic-link', AuthController.requestMagicLink);
router.post('/magic-link/verify', AuthController.verifyMagicLink);

// Password Reset (Single-use, expiring token)
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Profile & Verification
router.get('/me', requireAuth, AuthController.getMe);
router.get('/verify-email', AuthController.verifyEmail);
router.post('/verify-code', AuthController.verifyCode);
router.post('/resend-verification', AuthController.resendVerification);

export default router;
