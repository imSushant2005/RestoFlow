import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { parsePlan } from '../config/plans';

const hasRazorpayConfig = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

const razorpay = hasRazorpayConfig
  ? new Razorpay({
      key_id: env.RAZORPAY_KEY_ID!,
      key_secret: env.RAZORPAY_KEY_SECRET!,
    })
  : null;

// Razorpay amounts use paise.
const PLAN_PRICING = {
  MINI: 799 * 100,
  CAFE: 1599 * 100,
  DINEPRO: 3499 * 100,
  PREMIUM: 6499 * 100,
} as const;

export const createSubscriptionOrder = async (req: Request, res: Response) => {
  try {
    if (!hasRazorpayConfig || !razorpay) {
      return res.status(503).json({ success: false, error: 'Billing provider is not configured.' });
    }

    const normalizedPlan = parsePlan(req.body?.plan);
    if (!normalizedPlan) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

    const amount = PLAN_PRICING[normalizedPlan as keyof typeof PLAN_PRICING];
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
    if (!hasRazorpayConfig) {
      return res.status(503).json({ success: false, error: 'Billing provider is not configured.' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const normalizedPlan = parsePlan(req.body?.plan);

    if (!normalizedPlan) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature. Potential fraudulent request.' });
    }

    logger.warn(
      {
        tenantId: req.tenantId,
        plan: normalizedPlan,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
      'Client-side billing verification blocked until webhook-backed settlement ledger is implemented',
    );

    res.status(409).json({
      success: false,
      error: 'Plan upgrades are applied only after verified webhook settlement.',
      code: 'WEBHOOK_SETTLEMENT_REQUIRED',
    });
  } catch (error) {
    logger.error({ error }, 'Payment verification failure');
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    if (!hasRazorpayConfig) {
      return res.status(503).json({ success: false, error: 'Billing provider is not configured.' });
    }

    const signature = req.headers['x-razorpay-signature'] as string;
    const bodyText = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
      .update(bodyText)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    const event = req.body;

    if (event.event === 'subscription.charged') {
      const notes = event.payload.subscription.entity.notes;
      if (notes && notes.tenantId) {
        logger.info(
          { tenantId: notes.tenantId, plan: notes.plan, event: event.event },
          'Verified billing event received. No plan mutation applied without settlement ledger.',
        );
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error({ error }, 'Webhook execution failed');
    res.status(500).json({ success: false, error: 'Webhook structural failure' });
  }
};
