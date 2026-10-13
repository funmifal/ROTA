import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default-fallback-secret-rota',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
