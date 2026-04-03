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
router.put('/items/reorder', requireRoles([UserRole.OWNER, UserRole.MANAGER]), MenuController.reorderMenuItems);
router.patch('/items/bulk-availability', requireRoles([UserRole.OWNER, UserRole.MANAGER]), MenuController.bulkUpdateAvailability);
router.patch('/items/:id', requireRoles([UserRole.OWNER, UserRole.MANAGER]), MenuController.updateMenuItem);
router.patch('/items/:id/availability', requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER, UserRole.KITCHEN]), MenuController.toggleItemAvailability);
router.post('/bulk-import', requireRoles([UserRole.OWNER, UserRole.MANAGER]), MenuController.bulkImportMenu);

export default router;
