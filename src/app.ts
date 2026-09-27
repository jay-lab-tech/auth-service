import express from 'express';
import helmet from 'helmet';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.get('/health', async (_request, response) => {
  const [databaseCheck, redisCheck] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const databaseIsHealthy = databaseCheck.status === 'fulfilled';
  const redisIsHealthy = redisCheck.status === 'fulfilled' && redisCheck.value === 'PONG';
  const isHealthy = databaseIsHealthy && redisIsHealthy;

  response.status(isHealthy ? 200 : 503).json({
    data: {
      status: isHealthy ? 'ok' : 'degraded',
      dependencies: {
        postgres: databaseIsHealthy ? 'ok' : 'unavailable',
        redis: redisIsHealthy ? 'ok' : 'unavailable',
      },
    },
  });
});
