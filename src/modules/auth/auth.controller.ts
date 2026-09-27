import type { RequestHandler } from 'express';
import type { RegisterInput } from './auth.schemas.js';
import { registerUser } from './auth.service.js';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export const registerController: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const user = await registerUser(request.body as RegisterInput);
    response.status(201).json({ data: user });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Email sudah terdaftar',
        },
      });
      return;
    }

    next(error);
  }
};