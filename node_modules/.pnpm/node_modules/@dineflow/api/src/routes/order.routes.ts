import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { UserRole } from '@dineflow/prisma';
import * as OrderController from '../controllers/order.controller';

const router: Router = Router();

router.use(requireAuth);

// router.post('/', requireAuth, requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF]), OrderController.createOrder); // TODO: implement explicitly
router.get('/', requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF, UserRole.KITCHEN]), OrderController.getOrders);
router.get('/history', requireRoles([UserRole.OWNER, UserRole.MANAGER]), OrderController.getOrderHistory);
router.patch('/:id/status', requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF, UserRole.KITCHEN]), OrderController.updateOrderStatus);

export default router;
