import type { RequestHandler } from 'express';
import {
  changeUserRole,
  listAuditLogs,
  listUsers,
} from '../auth/auth.service.js';
import { changeRoleSchema, paginationSchema } from '../auth/auth.schemas.js';

function pagination(request: Parameters<RequestHandler>[0]) {
  const parsed = paginationSchema.safeParse(request.query);
  return parsed.success ? { ...parsed.data, skip: (parsed.data.page - 1) * parsed.data.limit } : null;
}

export const listUsersController: RequestHandler = async (request, response, next) => {
  try {
    const page = pagination(request);
    if (!page) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Parameter page/limit tidak valid' } });
      return;
    }
    const result = await listUsers(page.skip, page.limit);
    response.json({ data: result.users, meta: { page: page.page, limit: page.limit, total: result.total } });
  } catch (error) { next(error); }
};

export const changeRoleController: RequestHandler = async (request, response, next) => {
  try {
    const body = changeRoleSchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Role harus USER atau ADMIN' } });
      return;
    }
    const targetId = request.params.id;
    if (typeof targetId !== 'string') {
      response.status(400).json({ error: { code: 'INVALID_USER_ID', message: 'ID user tidak valid' } });
      return;
    }
    const actorId = request.auth!.userId;
    if (actorId === targetId) {
      response.status(400).json({ error: { code: 'SELF_ROLE_CHANGE', message: 'Admin tidak dapat mengubah role sendiri' } });
      return;
    }
    const user = await changeUserRole(actorId, targetId, body.data.role, {
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(request.get('user-agent') ? { userAgent: request.get('user-agent')!.slice(0, 500) } : {}),
    });
    response.json({ data: user });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      response.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User tidak ditemukan' } });
      return;
    }
    next(error);
  }
};

export const auditLogsController: RequestHandler = async (request, response, next) => {
  try {
    const page = pagination(request);
    if (!page) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Parameter page/limit tidak valid' } });
      return;
    }
    const result = await listAuditLogs(page.skip, page.limit);
    response.json({ data: result.logs, meta: { page: page.page, limit: page.limit, total: result.total } });
  } catch (error) { next(error); }
};
