import { Router } from 'express';
import { UserRole } from '@dineflow/prisma';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import * as OrderController from '../controllers/order.controller';
import { ORDER_ACCESS_ROLES, ORDER_HISTORY_ROLES } from '../constants/rbac.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

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
  idempotencyMiddleware,
  OrderController.createAssistedOrder,
);
router.get('/live', requireRoles(ORDER_ACCESS_ROLES), OrderController.getOrders);
router.get('/', requireRoles(ORDER_ACCESS_ROLES), OrderController.getOrders); // Fallback until UI migrated
router.get('/history', requireRoles(ORDER_HISTORY_ROLES), OrderController.getOrderHistory);
router.get('/:id', requireRoles(ORDER_ACCESS_ROLES), OrderController.getOrder);
router.patch('/:id/status', requireRoles(ORDER_ACCESS_ROLES), OrderController.updateOrderStatus);

export default router;
