import { Router } from 'express';
import * as PublicController from '../controllers/public.controller';
import * as TableController from '../controllers/table.controller';
import * as CustomerController from '../controllers/customer.controller';

const router: Router = Router();

// Domain Resolution for White-Label SPA
router.get('/resolve-domain', PublicController.resolveCustomDomain);

// Public Menu (No Auth Required)
router.get('/:tenantSlug/menu', PublicController.getPublicMenu);
router.post('/:tenantSlug/orders', PublicController.createOrder);
router.get('/:tenantSlug/sessions/:sessionToken/orders', PublicController.getSessionOrders);
router.get('/:tenantSlug/orders/:id', PublicController.getOrderInfo);
router.post('/orders/:id/feedback', PublicController.submitFeedback);
router.post('/:tenantSlug/waiter-call', PublicController.waiterCall);
router.post('/tables/:id/session', TableController.createSession);
router.post('/customer/login', CustomerController.login); // Backward-compatible alias

export default router;
