import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || 'test_key',
  key_secret: env.RAZORPAY_KEY_SECRET || 'test_secret',
});

// Map plans to INR monthly values
const PLAN_PRICING = {
  FREE: 0,
  PRO: 1999 * 100, // Razorpay uses paisa (₹1999.00)
  PREMIUM: 4999 * 100,
};

export const createSubscriptionOrder = async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    
    if (!['FREE', 'PRO', 'PREMIUM'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

    if (plan === 'FREE') {
      // Direct downgrade
      await prisma.tenant.update({ where: { id: req.tenantId }, data: { plan: 'FREE' } });
      return res.json({ success: true, message: 'Downgraded to Free Plan' });
    }

    const amount = PLAN_PRICING[plan as keyof typeof PLAN_PRICING];

    // Create Razorpay Order
    const orderOptions = {
      amount,
      currency: 'INR',
      receipt: `receipt_${req.tenantId}_${Date.now()}`,
      notes: { tenantId: req.tenantId, plan }
    };

    const order: any = await razorpay.orders.create(orderOptions as any);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    logger.error({ error }, 'Failed to construct Razorpay checkout instance');
    res.status(500).json({ success: false, error: 'Failed to initiate checkout session' });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET || 'test_secret')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid Payment Signature. Potential Fraudulent Request.' });
    }

    // Payment Verified Successfully. Upgrade the tenant plan.
    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { plan }
    });

    res.json({ success: true, message: 'Payment successful, plan upgraded.', plan });
  } catch (error) {
    logger.error({ error }, 'Payment Verification Failure');
    res.status(500).json({ success: false, error: 'Payment verification faulted centrally.' });
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
      return res.status(400).json({ success: false, error: 'Invalid Webhook Signature' });
    }

    const event = req.body;
    
    // Process recurring subscription renewal success
    if (event.event === 'subscription.charged') {
      const notes = event.payload.subscription.entity.notes;
      if (notes && notes.tenantId) {
        // You could log to a dedicated Payments Ledger table here
        logger.info(`Subscription charged successfully for Tenant ${notes.tenantId}`);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error({ error }, 'Webhook execution failed rigidly.');
    res.status(500).json({ success: false, error: 'Webhook structural failure' });
  }
};
