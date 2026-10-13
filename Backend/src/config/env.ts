import dotenv from 'dotenv';
dotenv.config();

const parsedSaltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
// Ensure cost factor is strictly >= 10 (defaults to 12)
const bcryptSaltRounds = isNaN(parsedSaltRounds) || parsedSaltRounds < 10 ? 12 : parsedSaltRounds;

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default-fallback-secret-rota',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  bcryptSaltRounds,
};

