"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSubscription = exports.refundPayment = exports.failPayment = exports.confirmPayment = exports.createCheckoutSession = exports.startTrial = exports.getBillingDetails = void 0;
const zod_1 = require("zod");
const subscription_billing_service_1 = require("../services/subscription-billing.service");
const checkoutSchema = zod_1.z.object({
    planId: zod_1.z.string().trim().min(1),
    billingCycle: zod_1.z.enum(['MONTHLY', 'YEARLY']).optional(),
    idempotencyKey: zod_1.z.string().trim().min(8).max(120).optional(),
    hasWaiterService: zod_1.z.boolean().optional(),
});
const trialSchema = zod_1.z.object({
    planId: zod_1.z.string().trim().min(1),
    hasWaiterService: zod_1.z.boolean().optional(),
});
const confirmPaymentSchema = zod_1.z.object({
    paymentMethod: zod_1.z.string().trim().min(2).max(80),
    providerReference: zod_1.z.string().trim().max(160).optional(),
    note: zod_1.z.string().trim().max(500).optional(),
    idempotencyKey: zod_1.z.string().trim().min(8).max(120).optional(),
});
const failPaymentSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().max(500).optional(),
});
const refundPaymentSchema = zod_1.z.object({
    note: zod_1.z.string().trim().max(500).optional(),
});
const cancelSubscriptionSchema = zod_1.z.object({
    atPeriodEnd: zod_1.z.boolean().optional(),
    note: zod_1.z.string().trim().max(500).optional(),
});
function respondBillingError(res, error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message === 'INVALID_PLAN')
        return res.status(400).json({ error: 'Invalid plan selected.' });
    if (message === 'TENANT_NOT_FOUND')
        return res.status(404).json({ error: 'Workspace not found.' });
    if (message === 'ATTEMPT_NOT_FOUND')
        return res.status(404).json({ error: 'Payment attempt not found.' });
    if (message === 'SUBSCRIPTION_NOT_FOUND')
        return res.status(404).json({ error: 'Subscription not found.' });
    if (message === 'SUCCESSFUL_ATTEMPT_CANNOT_BE_FAILED')
        return res.status(409).json({ error: 'A successful attempt cannot be marked failed.' });
    if (message === 'ONLY_SUCCESSFUL_ATTEMPTS_CAN_BE_REFUNDED')
        return res.status(409).json({ error: 'Only successful payments can be refunded.' });
    if (message === 'ATTEMPT_ALREADY_REFUNDED')
        return res.status(409).json({ error: 'This payment attempt is already refunded.' });
    return res.status(500).json({ error: 'Billing operation failed.' });
}
const getBillingDetails = async (req, res) => {
    try {
        const snapshot = await (0, subscription_billing_service_1.getTenantBillingSnapshot)(req.tenantId);
        return res.json(snapshot);
    }
    catch (error) {
        return respondBillingError(res, error);
    }
};
exports.getBillingDetails = getBillingDetails;
const startTrial = async (req, res) => {
    try {
        const payload = trialSchema.parse(req.body);
        const result = await (0, subscription_billing_service_1.startTrialForTenant)({
            tenantId: req.tenantId,
            actorUserId: req.user?.id,
            plan: payload.planId,
            hasWaiterService: payload.hasWaiterService,
        });
        return res.status(201).json({
            success: true,
            plan: result.plan,
            trialEndsAt: result.trialEndsAt,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return respondBillingError(res, error);
    }
};
exports.startTrial = startTrial;
const createCheckoutSession = async (req, res) => {
    try {
        const payload = checkoutSchema.parse(req.body);
        const attempt = await (0, subscription_billing_service_1.createSubscriptionPaymentAttempt)({
            tenantId: req.tenantId,
            actorUserId: req.user?.id,
            plan: payload.planId,
            billingCycle: payload.billingCycle,
            idempotencyKey: payload.idempotencyKey,
            hasWaiterService: payload.hasWaiterService,
        });
        return res.status(201).json({
            success: true,
            paymentAttempt: attempt,
            planCatalog: (0, subscription_billing_service_1.getPlanCatalog)(),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return respondBillingError(res, error);
    }
};
exports.createCheckoutSession = createCheckoutSession;
const confirmPayment = async (req, res) => {
    try {
        const payload = confirmPaymentSchema.parse(req.body);
        const result = await (0, subscription_billing_service_1.confirmSubscriptionPaymentAttempt)({
            tenantId: req.tenantId,
            attemptId: req.params.attemptId,
            actorUserId: req.user?.id,
            paymentMethod: payload.paymentMethod,
            providerReference: payload.providerReference,
            note: payload.note,
            idempotencyKey: payload.idempotencyKey,
        });
        return res.json({ success: true, ...result });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return respondBillingError(res, error);
    }
};
exports.confirmPayment = confirmPayment;
const failPayment = async (req, res) => {
    try {
        const payload = failPaymentSchema.parse(req.body);
        const attempt = await (0, subscription_billing_service_1.failSubscriptionPaymentAttempt)({
            tenantId: req.tenantId,
            attemptId: req.params.attemptId,
            reason: payload.reason,
        });
        return res.json({ success: true, paymentAttempt: attempt });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return respondBillingError(res, error);
    }
};
exports.failPayment = failPayment;
const refundPayment = async (req, res) => {
    try {
        const payload = refundPaymentSchema.parse(req.body);
        const attempt = await (0, subscription_billing_service_1.refundSubscriptionPaymentAttempt)({
            tenantId: req.tenantId,
            attemptId: req.params.attemptId,
            actorUserId: req.user?.id,
            note: payload.note,
        });
        return res.json({ success: true, paymentAttempt: attempt });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return respondBillingError(res, error);
    }
};
exports.refundPayment = refundPayment;
const cancelSubscription = async (req, res) => {
    try {
        const payload = cancelSubscriptionSchema.parse(req.body);
        const subscription = await (0, subscription_billing_service_1.cancelTenantSubscription)({
            tenantId: req.tenantId,
            actorUserId: req.user?.id,
            atPeriodEnd: payload.atPeriodEnd,
            note: payload.note,
        });
        return res.json({ success: true, subscription });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return respondBillingError(res, error);
    }
};
exports.cancelSubscription = cancelSubscription;
//# sourceMappingURL=billing.controller.js.map