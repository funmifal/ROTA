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
          details: error.errors,
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
          details: error.errors,
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
}
