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
const hasRazorpayConfig = Boolean(env_1.env.RAZORPAY_KEY_ID && env_1.env.RAZORPAY_KEY_SECRET);
const razorpay = hasRazorpayConfig
    ? new razorpay_1.default({
        key_id: env_1.env.RAZORPAY_KEY_ID,
        key_secret: env_1.env.RAZORPAY_KEY_SECRET,
    })
    : null;
// Razorpay amounts use paise.
const PLAN_PRICING = {
    MINI: 799 * 100,
    CAFE: 1599 * 100,
    BHOJPRO: 3499 * 100,
    PREMIUM: 6499 * 100,
};
const createSubscriptionOrder = async (req, res) => {
    try {
        if (!hasRazorpayConfig || !razorpay) {
            return res.status(503).json({ success: false, error: 'Billing provider is not configured.' });
        }
        const normalizedPlan = (0, plans_1.parsePlan)(req.body?.plan);
        if (!normalizedPlan) {
            return res.status(400).json({ success: false, error: 'Invalid plan selected' });
        }
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ success: false, error: 'Tenant not found' });
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
        if (!hasRazorpayConfig) {
            return res.status(503).json({ success: false, error: 'Billing provider is not configured.' });
        }
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const normalizedPlan = (0, plans_1.parsePlan)(req.body?.plan);
        if (!normalizedPlan) {
            return res.status(400).json({ success: false, error: 'Invalid plan selected' });
        }
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', env_1.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');
        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Invalid payment signature. Potential fraudulent request.' });
        }
        logger_1.logger.warn({
            tenantId: req.tenantId,
            plan: normalizedPlan,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
        }, 'Client-side billing verification blocked until webhook-backed settlement ledger is implemented');
        res.status(409).json({
            success: false,
            error: 'Plan upgrades are applied only after verified webhook settlement.',
            code: 'WEBHOOK_SETTLEMENT_REQUIRED',
        });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Payment verification failure');
        res.status(500).json({ success: false, error: 'Payment verification failed' });
    }
};
exports.verifyPayment = verifyPayment;
const handleWebhook = async (req, res) => {
    try {
        if (!hasRazorpayConfig) {
            return res.status(503).json({ success: false, error: 'Billing provider is not configured.' });
        }
        const signature = req.headers['x-razorpay-signature'];
        const bodyText = JSON.stringify(req.body);
        const expectedSignature = crypto_1.default
            .createHmac('sha256', env_1.env.RAZORPAY_KEY_SECRET)
            .update(bodyText)
            .digest('hex');
        if (expectedSignature !== signature) {
            return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
        }
        const event = req.body;
        if (event.event === 'subscription.charged') {
            const notes = event.payload.subscription.entity.notes;
            if (notes && notes.tenantId) {
                logger_1.logger.info({ tenantId: notes.tenantId, plan: notes.plan, event: event.event }, 'Verified billing event received. No plan mutation applied without settlement ledger.');
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