import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireAdmin } from '../../middlewares/rbac.js';
import { auditLogsController } from './user.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/audit-logs', auditLogsController);
