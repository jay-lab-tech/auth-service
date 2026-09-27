import { Router } from 'express';
import { validateBody } from '../../middlewares/validate.js';
import { registerController } from './auth.controller.js';
import { registerSchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(registerSchema),
  registerController,
);