import type { RequestHandler } from 'express';
import { redis } from '../config/redis.js';

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count
`;

export function loginRateLimit(maxAttempts = 5, windowMs = 15 * 60 * 1000): RequestHandler {
  return async (request, response, next) => {
    try {
      const ip = request.ip || request.socket.remoteAddress || 'unknown';
      const bucket = Math.floor(Date.now() / windowMs);
      const count = Number(await redis.eval(incrementScript, 1, `auth:login:${ip}:${bucket}`, windowMs));
      response.setHeader('RateLimit-Limit', String(maxAttempts));
      response.setHeader('RateLimit-Remaining', String(Math.max(0, maxAttempts - count)));
      if (count > maxAttempts) {
        response.setHeader('Retry-After', String(Math.ceil((windowMs - (Date.now() % windowMs)) / 1000)));
        response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan login; coba lagi nanti' } });
        return;
      }
      next();
    } catch {
      response.status(503).json({ error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Layanan pembatasan percobaan sedang tidak tersedia' } });
    }
  };
}
