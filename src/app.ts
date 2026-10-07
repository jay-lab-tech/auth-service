import express from 'express';
import helmet from 'helmet';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminRouter } from './modules/user/admin.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { corsMiddleware } from './middlewares/cors.js';
import path from 'node:path';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '10kb' }));
app.get(['/docs', '/docs/'], (_request, response) => {
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' https://unpkg.com 'unsafe-inline'; img-src 'self' data: https:");
  response.sendFile(path.resolve('docs/index.html'));
});
app.use('/docs', express.static('docs'));
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api', adminRouter);

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

app.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route tidak ditemukan' } });
});
app.use(errorHandler);
