import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireAdmin } from '../../middlewares/rbac.js';
import {
  changeRoleController,
  listUsersController,
} from './user.controller.js';

export const userRouter = Router();
userRouter.use(requireAuth, requireAdmin);
userRouter.get('/', listUsersController);
userRouter.patch('/:id/role', changeRoleController);
