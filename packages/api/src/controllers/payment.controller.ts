import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { parsePlan } from '../config/plans';

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || 'test_key',
  key_secret: env.RAZORPAY_KEY_SECRET || 'test_secret',
});

// Razorpay amounts use paise.
const PLAN_PRICING = {
  FREE: 0,
  STARTER: 1999 * 100,
  GOLD: 4999 * 100,
  PLATINUM: 9999 * 100,
} as const;

export const createSubscriptionOrder = async (req: Request, res: Response) => {
  try {
    const normalizedPlan = parsePlan(req.body?.plan);
    if (!normalizedPlan) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

    if (normalizedPlan === 'FREE') {
      await prisma.tenant.update({ where: { id: req.tenantId }, data: { plan: 'FREE' } });
      return res.json({ success: true, message: 'Downgraded to Free Plan' });
    }

    const amount = PLAN_PRICING[normalizedPlan];
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Plan pricing is invalid' });
    }

    const orderOptions = {
      amount,
      currency: 'INR',
      receipt: `receipt_${req.tenantId}_${Date.now()}`,
      notes: { tenantId: req.tenantId, plan: normalizedPlan },
    };

    const order: any = await razorpay.orders.create(orderOptions as any);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
      plan: normalizedPlan,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to construct Razorpay checkout instance');
    res.status(500).json({ success: false, error: 'Failed to initiate checkout session' });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const normalizedPlan = parsePlan(req.body?.plan);

    if (!normalizedPlan) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET || 'test_secret')
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature. Potential fraudulent request.' });
    }

    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { plan: normalizedPlan as any },
    });

    res.json({ success: true, message: 'Payment successful, plan upgraded.', plan: normalizedPlan });
  } catch (error) {
    logger.error({ error }, 'Payment verification failure');
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const bodyText = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET || 'test_secret')
      .update(bodyText)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    const event = req.body;

    if (event.event === 'subscription.charged') {
      const notes = event.payload.subscription.entity.notes;
      if (notes && notes.tenantId) {
        logger.info(`Subscription charged successfully for tenant ${notes.tenantId}`);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error({ error }, 'Webhook execution failed');
    res.status(500).json({ success: false, error: 'Webhook structural failure' });
  }
};
