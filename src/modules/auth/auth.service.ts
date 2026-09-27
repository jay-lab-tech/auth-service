import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/database.js';
import type { AuditAction, AuditStatus } from '../../generated/prisma/enums.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../../utils/tokens.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export type AuditMetadata = { ipAddress?: string; userAgent?: string };

function auditData(
  action: AuditAction,
  status: AuditStatus,
  metadata: AuditMetadata,
  userId?: string | null,
) {
  return {
    ...(userId ? { userId } : {}),
    action,
    status,
    ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
    ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
  };
}

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function registerUser(input: RegisterInput, metadata: AuditMetadata = {}) {
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: publicUserSelect,
    });
    await transaction.auditLog.create({
      data: auditData('REGISTER', 'SUCCESS', metadata, user.id),
    });
    return user;
  });
}

export async function loginUser(input: LoginInput, metadata: AuditMetadata = {}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = user
    ? await verifyPassword(user.passwordHash, input.password)
    : false;

  if (!user || !passwordMatches || !user.isActive) {
    await prisma.auditLog.create({
      data: auditData('LOGIN', 'FAILED', metadata, user?.id),
    });
    return null;
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  await prisma.$transaction([
    prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        familyId: randomUUID(),
        expiresAt,
        ...metadata,
      },
    }),
    prisma.auditLog.create({
      data: auditData('LOGIN', 'SUCCESS', metadata, user.id),
    }),
  ]);

  return { user: safeUser, accessToken, refreshToken };
}

export async function refreshUserSession(rawToken: string, metadata: AuditMetadata = {}) {
  const tokenHash = hashRefreshToken(rawToken);
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    await prisma.auditLog.create({ data: auditData('REFRESH', 'FAILED', metadata) });
    return null;
  }

  const now = new Date();
  if (session.revokedAt) {
    await prisma.$transaction([
      prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.auditLog.create({
        data: auditData('REFRESH', 'FAILED', metadata, session.userId),
      }),
    ]);
    return null;
  }

  if (session.expiresAt <= now || !session.user.isActive) {
    await prisma.$transaction([
      prisma.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.auditLog.create({
        data: auditData('REFRESH', 'FAILED', metadata, session.userId),
      }),
    ]);
    return null;
  }

  const nextRawToken = createRefreshToken();
  const nextExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextSessionId = randomUUID();
  const rotated = await prisma.$transaction(async (transaction) => {
    const revoked = await transaction.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now, replacedBy: nextSessionId },
    });
    if (revoked.count !== 1) return false;

    await transaction.refreshSession.create({
      data: {
        id: nextSessionId,
        userId: session.userId,
        tokenHash: hashRefreshToken(nextRawToken),
        familyId: session.familyId,
        expiresAt: nextExpiresAt,
        ...metadata,
      },
    });
    await transaction.auditLog.create({
      data: auditData('REFRESH', 'SUCCESS', metadata, session.userId),
    });
    return true;
  });

  if (!rotated) {
    await prisma.$transaction([
      prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: auditData('REFRESH', 'FAILED', metadata, session.userId),
      }),
    ]);
    return null;
  }

  return {
    accessToken: signAccessToken(session.user.id, session.user.role),
    refreshToken: nextRawToken,
  };
}

export async function logoutUser(userId: string, rawToken: string, metadata: AuditMetadata = {}) {
  const now = new Date();
  const result = await prisma.refreshSession.updateMany({
    where: { userId, tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: now },
  });
  await prisma.auditLog.create({
    data: auditData('LOGOUT', result.count ? 'SUCCESS' : 'FAILED', metadata, userId),
  });
  return result.count > 0;
}

export async function getCurrentUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
}

export async function listUsers(skip: number, take: number) {
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ skip, take, orderBy: { createdAt: 'desc' }, select: publicUserSelect }),
    prisma.user.count(),
  ]);
  return { users, total };
}

export async function changeUserRole(
  actorId: string,
  targetId: string,
  role: 'USER' | 'ADMIN',
  metadata: AuditMetadata = {},
) {
  if (actorId === targetId) return null;

  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id: targetId },
      data: { role },
      select: publicUserSelect,
    });
    await transaction.auditLog.create({
      data: auditData('ROLE_CHANGED', 'SUCCESS', metadata, actorId),
    });
    return updated;
  });
}

export async function listAuditLogs(skip: number, take: number) {
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  return { logs, total };
}
