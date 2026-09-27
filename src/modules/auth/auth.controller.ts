import type { RequestHandler } from 'express';
import { prisma } from '../../config/database.js';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
} from './auth.service.js';

function auditMetadata(request: Parameters<RequestHandler>[0]) {
  return {
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(request.get('user-agent') ? { userAgent: request.get('user-agent')!.slice(0, 500) } : {}),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export const registerController: RequestHandler = async (request, response, next) => {
  try {
    const user = await registerUser(request.body, auditMetadata(request));
    response.status(201).json({ data: user });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await prisma.auditLog.create({
        data: {
          action: 'REGISTER',
          status: 'FAILED',
          ...auditMetadata(request),
        },
      }).catch(next);
      response.status(409).json({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email sudah terdaftar' } });
      return;
    }
    next(error);
  }
};

export const loginController: RequestHandler = async (request, response, next) => {
  try {
    const result = await loginUser(request.body, auditMetadata(request));
    if (!result) {
      response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah' } });
      return;
    }
    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const refreshController: RequestHandler = async (request, response, next) => {
  try {
    const result = await refreshUserSession(request.body.refreshToken, auditMetadata(request));
    if (!result) {
      response.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token tidak valid atau sudah digunakan' } });
      return;
    }
    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const logoutController: RequestHandler = async (request, response, next) => {
  try {
    const revoked = await logoutUser(request.auth!.userId, request.body.refreshToken, auditMetadata(request));
    if (!revoked) {
      response.status(204).end();
      return;
    }
    response.status(200).json({ data: { message: 'Logout berhasil' } });
  } catch (error) {
    next(error);
  }
};

export const meController: RequestHandler = async (request, response, next) => {
  try {
    const user = await getCurrentUser(request.auth!.userId);
    if (!user || !user.isActive) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Akun tidak aktif atau tidak ditemukan' } });
      return;
    }
    response.json({ data: user });
  } catch (error) {
    next(error);
  }
};
