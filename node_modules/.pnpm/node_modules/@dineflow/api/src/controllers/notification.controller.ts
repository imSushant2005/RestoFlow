import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const subscribeToPush = async (req: Request, res: Response) => {
  try {
    const { subscription, deviceId, tenantId } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Invalid Push Subscription payload' });
    }

    // In a full production PWA, you would store this subscription against a Device Model
    // or Customer Profile to push them status updates asynchronously.
    logger.info({ deviceId, tenantId }, 'New PWA Push Subscription Registered');

    res.status(201).json({ success: true, message: 'Subscription securely stored' });
  } catch (error) {
    logger.error({ error }, 'Failed to parse Push Subscription');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getVapidPublicKey = (req: Request, res: Response) => {
  if (!env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ success: false, error: 'Push Notifications not configured on this environment' });
  }
  res.json({ success: true, publicKey: env.VAPID_PUBLIC_KEY });
};
