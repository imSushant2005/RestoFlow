import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { UserRole } from '@dineflow/prisma';
import * as SettingsController from '../controllers/settings.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/business', requireRoles([UserRole.OWNER, UserRole.MANAGER]), SettingsController.getBusinessSettings);
router.patch('/business', requireRoles([UserRole.OWNER]), SettingsController.updateBusinessSettings);

router.get('/staff', requireRoles([UserRole.OWNER, UserRole.MANAGER]), SettingsController.getStaff);
router.post('/staff', requireRoles([UserRole.OWNER]), SettingsController.createStaff);
router.delete('/staff/:id', requireRoles([UserRole.OWNER]), SettingsController.deleteStaff);

export default router;
