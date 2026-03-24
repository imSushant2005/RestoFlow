import { Router } from 'express';
import * as PublicController from '../controllers/public.controller';
import * as TableController from '../controllers/table.controller';

const router: Router = Router();

// Domain Resolution for White-Label SPA
router.get('/resolve-domain', PublicController.resolveCustomDomain);

// Public Menu (No Auth Required)
router.get('/:tenantSlug/menu', PublicController.getPublicMenu);
router.post('/:tenantSlug/orders', PublicController.createOrder);
router.get('/:tenantSlug/sessions/:sessionToken/orders', PublicController.getSessionOrders);
router.get('/:tenantSlug/orders/:id', PublicController.getOrderInfo);
router.post('/orders/:id/feedback', PublicController.submitFeedback);
router.post('/tables/:id/session', TableController.createSession);

export default router;
