import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import type { Role } from '../generated/prisma/enums.js';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role };
    }
  }
}

const accessSecret = process.env.JWT_ACCESS_SECRET;
if (!accessSecret || accessSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
}

export const requireAuth: RequestHandler = async (request, response, next) => {
  const authorization = request.header('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token diperlukan' } });
    return;
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, accessSecret, {
      algorithms: ['HS256'],
      issuer: 'auth-service',
      audience: 'auth-service',
    });
  } catch {
    response.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Access token tidak valid atau kedaluwarsa' } });
    return;
  }
  if (typeof payload === 'string' || !payload.sub ||
    (payload.role !== 'USER' && payload.role !== 'ADMIN')) {
    response.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Access token tidak valid' } });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Akun tidak aktif atau tidak ditemukan' } });
      return;
    }
    request.auth = { userId: payload.sub, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};
