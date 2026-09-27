import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (response.headersSent) return;
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Body harus berupa JSON yang valid' } });
    return;
  }
  console.error('Unhandled request error:', error);
  response.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Terjadi kesalahan pada server' },
  });
};
