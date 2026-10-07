import type { RequestHandler } from 'express';

const allowedOrigins = (process.env.CORS_ORIGIN ?? '*').split(',').map((origin) => origin.trim()).filter(Boolean);

export const corsMiddleware: RequestHandler = (request, response, next) => {
  const origin = request.header('origin');
  const allowsAnyOrigin = allowedOrigins.includes('*');
  if (origin && (allowsAnyOrigin || allowedOrigins.includes(origin))) {
    response.setHeader('Access-Control-Allow-Origin', allowsAnyOrigin ? '*' : origin);
    if (!allowsAnyOrigin) response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  next();
};
