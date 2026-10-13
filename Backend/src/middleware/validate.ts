import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Express middleware to validate request bodies against a Zod schema.
 * Automatically rejects invalid or malformed payloads before they reach business logic.
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: error.errors[0]?.message || 'Invalid request body.',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      res.status(400).json({
        error: 'ValidationError',
        message: 'Request body failed validation.',
      });
    }
  };
}
