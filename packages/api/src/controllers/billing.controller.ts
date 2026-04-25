import { Request, Response } from 'express';
import { z } from 'zod';
import {
  cancelTenantSubscription,
  confirmSubscriptionPaymentAttempt,
  createSubscriptionPaymentAttempt,
  failSubscriptionPaymentAttempt,
  getPlanCatalog,
  getTenantBillingSnapshot,
  refundSubscriptionPaymentAttempt,
  startTrialForTenant,
} from '../services/subscription-billing.service';

const checkoutSchema = z.object({
  planId: z.string().trim().min(1),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  hasWaiterService: z.boolean().optional(),
});

const trialSchema = z.object({
  planId: z.string().trim().min(1),
  hasWaiterService: z.boolean().optional(),
});

const confirmPaymentSchema = z.object({
  paymentMethod: z.string().trim().min(2).max(80),
  providerReference: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

const failPaymentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const refundPaymentSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

const cancelSubscriptionSchema = z.object({
  atPeriodEnd: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
});

function respondBillingError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (message === 'INVALID_PLAN') return res.status(400).json({ error: 'Invalid plan selected.' });
  if (message === 'TENANT_NOT_FOUND') return res.status(404).json({ error: 'Workspace not found.' });
  if (message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ error: 'Payment attempt not found.' });
  if (message === 'SUBSCRIPTION_NOT_FOUND') return res.status(404).json({ error: 'Subscription not found.' });
  if (message === 'SUCCESSFUL_ATTEMPT_CANNOT_BE_FAILED') return res.status(409).json({ error: 'A successful attempt cannot be marked failed.' });
  if (message === 'ONLY_SUCCESSFUL_ATTEMPTS_CAN_BE_REFUNDED') return res.status(409).json({ error: 'Only successful payments can be refunded.' });
  if (message === 'ATTEMPT_ALREADY_REFUNDED') return res.status(409).json({ error: 'This payment attempt is already refunded.' });

  return res.status(500).json({ error: 'Billing operation failed.' });
}

export const getBillingDetails = async (req: Request, res: Response) => {
  try {
    const snapshot = await getTenantBillingSnapshot(req.tenantId!);
    return res.json(snapshot);
  } catch (error) {
    return respondBillingError(res, error);
  }
};

export const startTrial = async (req: Request, res: Response) => {
  try {
    const payload = trialSchema.parse(req.body);
    const result = await startTrialForTenant({
      tenantId: req.tenantId!,
      actorUserId: req.user?.id,
      plan: payload.planId,
      hasWaiterService: payload.hasWaiterService,
    });

    return res.status(201).json({
      success: true,
      plan: result.plan,
      trialEndsAt: result.trialEndsAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    return respondBillingError(res, error);
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const payload = checkoutSchema.parse(req.body);
    const attempt = await createSubscriptionPaymentAttempt({
      tenantId: req.tenantId!,
      actorUserId: req.user?.id,
      plan: payload.planId,
      billingCycle: payload.billingCycle,
      idempotencyKey: payload.idempotencyKey,
      hasWaiterService: payload.hasWaiterService,
    });

    return res.status(201).json({
      success: true,
      paymentAttempt: attempt,
      planCatalog: getPlanCatalog(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    return respondBillingError(res, error);
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const payload = confirmPaymentSchema.parse(req.body);
    const result = await confirmSubscriptionPaymentAttempt({
      tenantId: req.tenantId!,
      attemptId: req.params.attemptId,
      actorUserId: req.user?.id,
      paymentMethod: payload.paymentMethod,
      providerReference: payload.providerReference,
      note: payload.note,
      idempotencyKey: payload.idempotencyKey,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    return respondBillingError(res, error);
  }
};

export const failPayment = async (req: Request, res: Response) => {
  try {
    const payload = failPaymentSchema.parse(req.body);
    const attempt = await failSubscriptionPaymentAttempt({
      tenantId: req.tenantId!,
      attemptId: req.params.attemptId,
      reason: payload.reason,
    });

    return res.json({ success: true, paymentAttempt: attempt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    return respondBillingError(res, error);
  }
};

export const refundPayment = async (req: Request, res: Response) => {
  try {
    const payload = refundPaymentSchema.parse(req.body);
    const attempt = await refundSubscriptionPaymentAttempt({
      tenantId: req.tenantId!,
      attemptId: req.params.attemptId,
      actorUserId: req.user?.id,
      note: payload.note,
    });

    return res.json({ success: true, paymentAttempt: attempt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    return respondBillingError(res, error);
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const payload = cancelSubscriptionSchema.parse(req.body);
    const subscription = await cancelTenantSubscription({
      tenantId: req.tenantId!,
      actorUserId: req.user?.id,
      atPeriodEnd: payload.atPeriodEnd,
      note: payload.note,
    });

    return res.json({ success: true, subscription });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    return respondBillingError(res, error);
  }
};
