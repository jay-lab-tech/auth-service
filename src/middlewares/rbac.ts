import type { RequestHandler } from 'express';

export const requireAdmin: RequestHandler = (request, response, next) => {
  if (request.auth?.role !== 'ADMIN') {
    response.status(request.auth ? 403 : 401).json({
      error: {
        code: request.auth ? 'FORBIDDEN' : 'UNAUTHORIZED',
        message: request.auth ? 'Akses khusus admin' : 'Autentikasi diperlukan',
      },
    });
    return;
  }
  next();
};
