import { Router } from 'express';
import * as NotificationController from '../controllers/notification.controller';

const router: Router = Router();

// Publicly accessible for PWA Service Workers 
router.get('/vapid-public-key', NotificationController.getVapidPublicKey);
router.post('/subscribe', NotificationController.subscribeToPush);

export default router;
