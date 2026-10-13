import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .refine(
      (val) => {
        const words = val.trim().split(/\s+/).filter(Boolean);
        return words.length >= 2;
      },
      { message: 'Please enter at least 2 words (e.g. first and last name)' }
    )
    .refine(
      (val) => /^[a-zA-Z\s]+$/.test(val),
      { message: 'Name Must Use Only Letters' }
    ),
  firstName: z.string().trim().optional(),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email('Enter A Valid Email Address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
