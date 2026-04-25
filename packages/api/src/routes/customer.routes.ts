import { Router } from 'express';
import * as CustomerController from '../controllers/customer.controller';
import { customerAuth } from '../middleware/customerAuth';

const router: Router = Router();

// Public
router.post('/login', CustomerController.login);
router.post('/register', CustomerController.register);
router.post('/auth/login', CustomerController.loginWithPassword);

// Protected (requires customer JWT)
router.get('/profile', customerAuth, CustomerController.getProfile);
router.post('/account/deactivate', customerAuth, CustomerController.deactivateAccount);
router.get('/history', customerAuth, CustomerController.getHistory);
router.get('/history/:sessionId', customerAuth, CustomerController.getSessionDetail);

export default router;
