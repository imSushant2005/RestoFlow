import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { UserRole } from '@dineflow/prisma';
import * as MenuController from '../controllers/menu.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/categories', MenuController.getCategories);
router.post('/categories', requireRoles([UserRole.OWNER, UserRole.MANAGER]), MenuController.createCategory);
router.put('/categories/reorder', requireRoles([UserRole.OWNER, UserRole.MANAGER]), MenuController.reorderCategories);

router.get('/items', MenuController.getMenuItems);
router.post('/items', requireRoles([UserRole.OWNER, UserRole.MANAGER]), MenuController.createMenuItem);
router.patch('/items/:id/availability', requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF, UserRole.KITCHEN]), MenuController.toggleItemAvailability);

export default router;
