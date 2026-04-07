import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import * as SettingsController from '../controllers/settings.controller';
import { BUSINESS_SETTINGS_READ_ROLES, FULL_ACCESS_ROLES } from '../constants/rbac';

const router: Router = Router();

router.use(requireAuth);

router.get('/business', requireRoles(BUSINESS_SETTINGS_READ_ROLES), SettingsController.getBusinessSettings);
router.patch('/business', requireRoles(FULL_ACCESS_ROLES), SettingsController.updateBusinessSettings);

router.get('/staff', requireRoles(FULL_ACCESS_ROLES), SettingsController.getStaff);
router.post('/staff', requireRoles(FULL_ACCESS_ROLES), SettingsController.createStaff);
router.patch('/staff/:id', requireRoles(FULL_ACCESS_ROLES), SettingsController.updateStaff);
router.delete('/staff/:id', requireRoles(FULL_ACCESS_ROLES), SettingsController.deleteStaff);

export default router;
