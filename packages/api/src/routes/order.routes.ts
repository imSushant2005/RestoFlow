import { Router } from 'express';
import { UserRole } from '@dineflow/prisma';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import * as OrderController from '../controllers/order.controller';
import { ORDER_ACCESS_ROLES, ORDER_HISTORY_ROLES } from '../constants/rbac.js';

const router: Router = Router();

router.use(requireAuth);

// router.post('/', requireAuth, requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER]), OrderController.createOrder); // TODO: implement explicitly
router.get(
  '/assisted/customer-lookup',
  requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER]),
  OrderController.lookupAssistedCustomer,
);
router.post(
  '/assisted',
  requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER]),
  OrderController.createAssistedOrder,
);
router.get('/', requireRoles(ORDER_ACCESS_ROLES), OrderController.getOrders);
router.get('/history', requireRoles(ORDER_HISTORY_ROLES), OrderController.getOrderHistory);
router.patch('/:id/status', requireRoles(ORDER_ACCESS_ROLES), OrderController.updateOrderStatus);

export default router;
