import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';

const port = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    await redis.connect();
    await redis.ping();

    app.listen(port, () => {
      console.log(`Auth Service listening on port ${port}`);
    });
  } catch (error) {
    console.error('Auth Service failed to start because a dependency is unavailable.');
    console.error(error);
    redis.disconnect();
    await prisma.$disconnect().catch(() => undefined);
    process.exitCode = 1;
  }
}

void startServer();
