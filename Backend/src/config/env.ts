import dotenv from 'dotenv';
dotenv.config();

const parsedSaltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
// Ensure cost factor is strictly >= 10 (defaults to 12)
const bcryptSaltRounds = isNaN(parsedSaltRounds) || parsedSaltRounds < 10 ? 12 : parsedSaltRounds;

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || '5000'}`,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default-fallback-secret-rota',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  bcryptSaltRounds,
  email: {
    from: process.env.EMAIL_FROM || 'Rota <noreply@rotaapp.com>',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
};

