"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = exports.verifyPayment = exports.createSubscriptionOrder = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../db/prisma");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const plans_1 = require("../config/plans");
const razorpay = new razorpay_1.default({
    key_id: env_1.env.RAZORPAY_KEY_ID || 'test_key',
    key_secret: env_1.env.RAZORPAY_KEY_SECRET || 'test_secret',
});
// Razorpay amounts use paise.
const PLAN_PRICING = {
    FREE: 0,
    STARTER: 1999 * 100,
    GOLD: 4999 * 100,
    PLATINUM: 9999 * 100,
};
const createSubscriptionOrder = async (req, res) => {
    try {
        const normalizedPlan = (0, plans_1.parsePlan)(req.body?.plan);
        if (!normalizedPlan) {
            return res.status(400).json({ success: false, error: 'Invalid plan selected' });
        }
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        if (normalizedPlan === 'FREE') {
            await prisma_1.prisma.tenant.update({ where: { id: req.tenantId }, data: { plan: 'FREE' } });
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
        const order = await razorpay.orders.create(orderOptions);
        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: env_1.env.RAZORPAY_KEY_ID,
            plan: normalizedPlan,
        });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to construct Razorpay checkout instance');
        res.status(500).json({ success: false, error: 'Failed to initiate checkout session' });
    }
};
exports.createSubscriptionOrder = createSubscriptionOrder;
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const normalizedPlan = (0, plans_1.parsePlan)(req.body?.plan);
        if (!normalizedPlan) {
            return res.status(400).json({ success: false, error: 'Invalid plan selected' });
        }
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', env_1.env.RAZORPAY_KEY_SECRET || 'test_secret')
            .update(body)
            .digest('hex');
        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Invalid payment signature. Potential fraudulent request.' });
        }
        await prisma_1.prisma.tenant.update({
            where: { id: req.tenantId },
            data: { plan: normalizedPlan },
        });
        res.json({ success: true, message: 'Payment successful, plan upgraded.', plan: normalizedPlan });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Payment verification failure');
        res.status(500).json({ success: false, error: 'Payment verification failed' });
    }
};
exports.verifyPayment = verifyPayment;
const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const bodyText = JSON.stringify(req.body);
        const expectedSignature = crypto_1.default
            .createHmac('sha256', env_1.env.RAZORPAY_KEY_SECRET || 'test_secret')
            .update(bodyText)
            .digest('hex');
        if (expectedSignature !== signature) {
            return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
        }
        const event = req.body;
        if (event.event === 'subscription.charged') {
            const notes = event.payload.subscription.entity.notes;
            if (notes && notes.tenantId) {
                logger_1.logger.info(`Subscription charged successfully for tenant ${notes.tenantId}`);
            }
        }
        res.json({ status: 'ok' });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Webhook execution failed');
        res.status(500).json({ success: false, error: 'Webhook structural failure' });
    }
};
exports.handleWebhook = handleWebhook;
//# sourceMappingURL=payment.controller.js.map