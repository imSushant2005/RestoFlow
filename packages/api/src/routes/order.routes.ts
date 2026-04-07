import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import * as OrderController from '../controllers/order.controller';
import { ORDER_ACCESS_ROLES, ORDER_HISTORY_ROLES } from '../constants/rbac';

const router: Router = Router();

router.use(requireAuth);

// router.post('/', requireAuth, requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER]), OrderController.createOrder); // TODO: implement explicitly
router.get('/', requireRoles(ORDER_ACCESS_ROLES), OrderController.getOrders);
router.get('/history', requireRoles(ORDER_HISTORY_ROLES), OrderController.getOrderHistory);
router.patch('/:id/status', requireRoles(ORDER_ACCESS_ROLES), OrderController.updateOrderStatus);

export default router;
