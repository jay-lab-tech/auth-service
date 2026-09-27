import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

const accessSecret: string = (() => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
  }

  return secret;
})();

export type UserRole = 'USER' | 'ADMIN';

export function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign(
    { role },
    accessSecret,
    {
      algorithm: 'HS256',
      subject: userId,
      issuer: 'auth-service',
      audience: 'auth-service',
      expiresIn: '15m',
    },
  );
}

export function createRefreshToken(): string {
  return randomBytes(64).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
