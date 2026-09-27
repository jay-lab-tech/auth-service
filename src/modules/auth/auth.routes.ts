import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { loginRateLimit } from '../../middlewares/rateLimit.js';
import { validateBody } from '../../middlewares/validate.js';
import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from './auth.controller.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), registerController);
authRouter.post('/login', loginRateLimit(), validateBody(loginSchema), loginController);
authRouter.post('/refresh', validateBody(refreshSchema), refreshController);
authRouter.post('/logout', requireAuth, validateBody(logoutSchema), logoutController);
authRouter.get('/me', requireAuth, meController);
