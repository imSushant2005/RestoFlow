import {
  BillingLedgerEntryType,
  PaymentAttemptStatus,
  Plan,
  PlanChangeReason,
  Prisma,
  SubscriptionCycle,
  SubscriptionInvoiceStatus,
  SubscriptionStatus,
} from '@bhojflow/prisma';
import { randomUUID } from 'crypto';
import { prisma } from '../db/prisma';
import { getPlanLimits, normalizePlan, parsePlan, type CanonicalPlan } from '../config/plans';
import { logger } from '../utils/logger';
import { enqueueJob } from './job-queue.service';

const BILLING_CURRENCY = 'INR';
const TRIAL_DURATION_DAYS = 30;

const YEARLY_MULTIPLIER = 10;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addBillingInterval(date: Date, cycle: SubscriptionCycle) {
  const next = new Date(date);
  if (cycle === SubscriptionCycle.YEARLY) {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function buildInvoiceNumber() {
  return `BHF-${randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
}

function buildAttemptIdempotencyKey(tenantId: string, plan: Plan, cycle: SubscriptionCycle) {
  return `${tenantId}:${plan}:${cycle}:${new Date().toISOString().slice(0, 10)}`;
}

function toSubscriptionCycle(raw: unknown) {
  return String(raw || '').trim().toUpperCase() === 'YEARLY'
    ? SubscriptionCycle.YEARLY
    : SubscriptionCycle.MONTHLY;
}

function getPlanChargeAmount(plan: Plan | CanonicalPlan, cycle: SubscriptionCycle) {
  const monthly = getPlanLimits(plan).price;
  return cycle === SubscriptionCycle.YEARLY ? monthly * YEARLY_MULTIPLIER : monthly;
}

export function getPlanCatalog() {
  return (['MINI', 'CAFE', 'BHOJPRO', 'PREMIUM'] as const).map((plan) => ({
    id: plan,
    name: getPlanLimits(plan).name,
    monthlyAmount: getPlanChargeAmount(plan, SubscriptionCycle.MONTHLY),
    yearlyAmount: getPlanChargeAmount(plan, SubscriptionCycle.YEARLY),
    yearlyDiscountMonths: 2,
  }));
}

export async function getTenantBillingSnapshot(tenantId: string) {
  const [tenant, subscription, paymentAttempts, invoices, ledgerEntries] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        businessName: true,
        email: true,
        plan: true,
        trialEndsAt: true,
        planStartedAt: true,
        planExpiresAt: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { tenantId },
    }),
    prisma.paymentAttempt.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.subscriptionInvoice.findMany({
      where: { tenantId },
      orderBy: { issuedAt: 'desc' },
      take: 10,
    }),
    prisma.billingLedgerEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return {
    tenant,
    subscription,
    paymentAttempts,
    invoices,
    ledgerEntries,
    plans: getPlanCatalog(),
  };
}

type TrialActivationInput = {
  tenantId: string;
  actorUserId?: string | null;
  plan: unknown;
  hasWaiterService?: boolean;
};

async function activateTrialInTransaction(
  tx: Prisma.TransactionClient,
  input: TrialActivationInput,
) {
  const normalizedPlan = parsePlan(input.plan);
  if (!normalizedPlan) {
    throw new Error('INVALID_PLAN');
  }

  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DURATION_DAYS);

  const tenant = await tx.tenant.findUnique({
    where: { id: input.tenantId },
    select: {
      id: true,
      plan: true,
      trialEndsAt: true,
      trialStartedAt: true,
      trialStatus: true,
      hasWaiterService: true,
    },
  });

  if (!tenant) {
    throw new Error('TENANT_NOT_FOUND');
  }

  const existingSubscription = await tx.subscription.findUnique({
    where: { tenantId: input.tenantId },
  });

  if (tenant.trialStartedAt && tenant.trialStatus !== 'NOT_STARTED') {
    return {
      subscription: existingSubscription,
      trialEndsAt: tenant.trialEndsAt ?? trialEndsAt,
      plan: existingSubscription?.plan || normalizedPlan,
      created: false,
    };
  }

  const subscription = await tx.subscription.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      plan: normalizedPlan,
      billingCycle: SubscriptionCycle.MONTHLY,
      status: SubscriptionStatus.TRIALING,
      trialStartsAt: now,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
    update: {
      plan: normalizedPlan,
      billingCycle: SubscriptionCycle.MONTHLY,
      status: SubscriptionStatus.TRIALING,
      trialStartsAt: now,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });

  await tx.tenant.update({
    where: { id: input.tenantId },
    data: {
      plan: normalizedPlan,
      planStartedAt: now,
      planExpiresAt: trialEndsAt,
      trialStartedAt: now,
      trialEndsAt,
      trialStatus: 'ACTIVE',
      hasWaiterService: input.hasWaiterService ?? tenant.hasWaiterService,
    },
  });

  await tx.planHistory.create({
    data: {
      tenantId: input.tenantId,
      subscriptionId: subscription.id,
      fromPlan: tenant.plan,
      toPlan: normalizedPlan,
      billingCycle: SubscriptionCycle.MONTHLY,
      reason: PlanChangeReason.TRIAL_START,
      effectiveAt: now,
      actorUserId: input.actorUserId || null,
      note: '30-day founder-led trial activated',
    },
  });

  await tx.billingLedgerEntry.create({
    data: {
      tenantId: input.tenantId,
      subscriptionId: subscription.id,
      entryType: BillingLedgerEntryType.CREDIT,
      amount: 0,
      currency: BILLING_CURRENCY,
      note: `Trial started for ${normalizedPlan}`,
      metadata: {
        plan: normalizedPlan,
        trialEndsAt: trialEndsAt.toISOString(),
      },
    },
  });

  return { subscription, trialEndsAt, plan: normalizedPlan, created: true };
}

export async function startTrialForTenant(input: TrialActivationInput) {
  return prisma.$transaction(async (tx) => activateTrialInTransaction(tx, input));
}

export async function startTrialForTenantTransaction(
  tx: Prisma.TransactionClient,
  input: TrialActivationInput,
) {
  return activateTrialInTransaction(tx, input);
}

export async function createSubscriptionPaymentAttempt(input: {
  tenantId: string;
  actorUserId?: string | null;
  plan: unknown;
  billingCycle?: unknown;
  idempotencyKey?: string | null;
  hasWaiterService?: boolean;
}) {
  const normalizedPlan = parsePlan(input.plan);
  if (!normalizedPlan) {
    throw new Error('INVALID_PLAN');
  }

  const cycle = toSubscriptionCycle(input.billingCycle);
  const idempotencyKey = String(input.idempotencyKey || '').trim() || buildAttemptIdempotencyKey(input.tenantId, normalizedPlan, cycle);
  const amount = getPlanChargeAmount(normalizedPlan, cycle);
  const dueAt = addDays(new Date(), 2);

  const existing = await prisma.paymentAttempt.findUnique({
    where: {
      tenantId_idempotencyKey: {
        tenantId: input.tenantId,
        idempotencyKey,
      },
    },
    include: {
      invoice: true,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, plan: true },
    });
    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    const subscription = await tx.subscription.findUnique({ where: { tenantId: input.tenantId } });

    const invoice = await tx.subscriptionInvoice.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: subscription?.id,
        invoiceNumber: buildInvoiceNumber(),
        plan: normalizedPlan,
        billingCycle: cycle,
        status: SubscriptionInvoiceStatus.PENDING,
        amount,
        currency: BILLING_CURRENCY,
        dueAt,
        periodStart: new Date(),
        periodEnd: addBillingInterval(new Date(), cycle),
      },
    });

    const attempt = await tx.paymentAttempt.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: subscription?.id,
        invoiceId: invoice.id,
        targetPlan: normalizedPlan,
        billingCycle: cycle,
        status: PaymentAttemptStatus.PENDING,
        amount,
        currency: BILLING_CURRENCY,
        idempotencyKey,
        metadata: {
          requestedByUserId: input.actorUserId || null,
          previousPlan: normalizePlan(tenant.plan),
          hasWaiterService: Boolean(input.hasWaiterService),
        },
      },
      include: {
        invoice: true,
      },
    });

    logger.info(
      {
        tenantId: input.tenantId,
        attemptId: attempt.id,
        plan: normalizedPlan,
        cycle,
        amount,
      },
      'Subscription payment attempt created',
    );

    return attempt;
  });
}

export async function confirmSubscriptionPaymentAttempt(input: {
  tenantId: string;
  attemptId: string;
  actorUserId?: string | null;
  paymentMethod: string;
  providerReference?: string | null;
  note?: string | null;
  idempotencyKey?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findFirst({
      where: { id: input.attemptId, tenantId: input.tenantId },
      include: {
        invoice: true,
        subscription: true,
      },
    });

    if (!attempt) {
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    if (attempt.status === PaymentAttemptStatus.REFUNDED) {
      throw new Error('ATTEMPT_ALREADY_REFUNDED');
    }

    if (attempt.status === PaymentAttemptStatus.SUCCESS) {
      return attempt;
    }

    const tenant = await tx.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, plan: true },
    });
    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    const now = new Date();
    const currentPeriodEnd = addBillingInterval(now, attempt.billingCycle);

    const subscription = await tx.subscription.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        plan: attempt.targetPlan,
        billingCycle: attempt.billingCycle,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
        lastPaymentAt: now,
        lastPaymentAttemptId: attempt.id,
      },
      update: {
        plan: attempt.targetPlan,
        billingCycle: attempt.billingCycle,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
        trialStartsAt: null,
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        nextRetryAt: null,
        lastPaymentAt: now,
        lastPaymentAttemptId: attempt.id,
      },
    });

    const updatedAttempt = await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        subscriptionId: subscription.id,
        status: PaymentAttemptStatus.SUCCESS,
        paymentMethod: input.paymentMethod,
        providerReference: input.providerReference?.trim() || null,
        processedAt: now,
        failureReason: null,
        metadata: {
          ...(attempt.metadata as Prisma.JsonObject | undefined),
          confirmationIdempotencyKey: input.idempotencyKey || null,
          note: input.note || null,
        },
      },
      include: {
        invoice: true,
      },
    });

    const invoice = attempt.invoice
      ? await tx.subscriptionInvoice.update({
          where: { id: attempt.invoice.id },
          data: {
            subscriptionId: subscription.id,
            status: SubscriptionInvoiceStatus.PAID,
            paidAt: now,
            periodStart: now,
            periodEnd: currentPeriodEnd,
          },
        })
      : null;

    await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        plan: attempt.targetPlan,
        planStartedAt: now,
        planExpiresAt: currentPeriodEnd,
        trialStatus: 'CONVERTED',
        trialEndsAt: null,
      },
    });

    await tx.planHistory.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        paymentAttemptId: attempt.id,
        fromPlan: tenant.plan,
        toPlan: attempt.targetPlan,
        billingCycle: attempt.billingCycle,
        reason: tenant.plan === attempt.targetPlan ? PlanChangeReason.RENEWAL : PlanChangeReason.UPGRADE,
        effectiveAt: now,
        actorUserId: input.actorUserId || null,
        note: input.note || `Paid via ${input.paymentMethod}`,
      },
    });

    await tx.billingLedgerEntry.createMany({
      data: [
        {
          tenantId: input.tenantId,
          subscriptionId: subscription.id,
          paymentAttemptId: attempt.id,
          invoiceId: invoice?.id,
          entryType: tenant.plan === attempt.targetPlan ? BillingLedgerEntryType.RENEWAL : BillingLedgerEntryType.CHARGE,
          amount: attempt.amount,
          currency: attempt.currency,
          note: `Subscription payment received for ${attempt.targetPlan}`,
          metadata: {
            paymentMethod: input.paymentMethod,
            providerReference: input.providerReference || null,
          },
        },
        {
          tenantId: input.tenantId,
          subscriptionId: subscription.id,
          paymentAttemptId: attempt.id,
          invoiceId: invoice?.id,
          entryType: BillingLedgerEntryType.PLAN_CHANGE,
          amount: 0,
          currency: attempt.currency,
          note: `Plan set to ${attempt.targetPlan}`,
          metadata: {
            fromPlan: tenant.plan,
            toPlan: attempt.targetPlan,
            cycle: attempt.billingCycle,
          },
        },
      ],
    });

    logger.info(
      {
        tenantId: input.tenantId,
        attemptId: attempt.id,
        subscriptionId: subscription.id,
        plan: attempt.targetPlan,
      },
      'Subscription payment attempt confirmed',
    );

    await enqueueJob('billing.receipt.issue', {
      tenantId: input.tenantId,
      attemptId: attempt.id,
      invoiceId: invoice?.id || null,
      subscriptionId: subscription.id,
      plan: attempt.targetPlan,
      billingCycle: attempt.billingCycle,
      paymentMethod: input.paymentMethod,
      providerReference: input.providerReference?.trim() || null,
      amount: attempt.amount,
      currency: attempt.currency,
      paidAt: now.toISOString(),
    });

    return {
      attempt: updatedAttempt,
      invoice,
      subscription,
      currentPeriodEnd,
    };
  });
}

export async function failSubscriptionPaymentAttempt(input: {
  tenantId: string;
  attemptId: string;
  reason?: string | null;
}) {
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { id: input.attemptId, tenantId: input.tenantId },
  });
  if (!attempt) {
    throw new Error('ATTEMPT_NOT_FOUND');
  }
  if (attempt.status === PaymentAttemptStatus.SUCCESS) {
    throw new Error('SUCCESSFUL_ATTEMPT_CANNOT_BE_FAILED');
  }
  if (attempt.status === PaymentAttemptStatus.FAILED) {
    return attempt;
  }

  return prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: PaymentAttemptStatus.FAILED,
      failureReason: input.reason?.trim() || 'Payment not received',
      processedAt: new Date(),
    },
  });
}

export async function refundSubscriptionPaymentAttempt(input: {
  tenantId: string;
  attemptId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findFirst({
      where: { id: input.attemptId, tenantId: input.tenantId },
      include: { invoice: true, subscription: true },
    });
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');
    if (attempt.status === PaymentAttemptStatus.REFUNDED) return attempt;
    if (attempt.status !== PaymentAttemptStatus.SUCCESS) {
      throw new Error('ONLY_SUCCESSFUL_ATTEMPTS_CAN_BE_REFUNDED');
    }

    const now = new Date();

    const updatedAttempt = await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: PaymentAttemptStatus.REFUNDED,
        refundedAt: now,
        processedAt: now,
      },
      include: { invoice: true, subscription: true },
    });

    if (attempt.invoiceId) {
      await tx.subscriptionInvoice.update({
        where: { id: attempt.invoiceId },
        data: { status: SubscriptionInvoiceStatus.REFUNDED },
      });
    }

    await tx.billingLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: attempt.subscriptionId,
        paymentAttemptId: attempt.id,
        invoiceId: attempt.invoiceId,
        entryType: BillingLedgerEntryType.REFUND,
        amount: -Math.abs(attempt.amount),
        currency: attempt.currency,
        note: input.note || 'Subscription payment refunded',
      },
    });

    await tx.planHistory.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: attempt.subscriptionId,
        paymentAttemptId: attempt.id,
        fromPlan: attempt.targetPlan,
        toPlan: attempt.targetPlan,
        billingCycle: attempt.billingCycle,
        reason: PlanChangeReason.REFUND,
        effectiveAt: now,
        actorUserId: input.actorUserId || null,
        note: input.note || 'Refund recorded for subscription payment',
      },
    });

    return updatedAttempt;
  });
}

export async function cancelTenantSubscription(input: {
  tenantId: string;
  actorUserId?: string | null;
  atPeriodEnd?: boolean;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { tenantId: input.tenantId },
    });
    if (!subscription) {
      throw new Error('SUBSCRIPTION_NOT_FOUND');
    }

    const now = new Date();
    const atPeriodEnd = input.atPeriodEnd !== false;

    const updated = await tx.subscription.update({
      where: { tenantId: input.tenantId },
      data: atPeriodEnd
        ? {
            cancelAtPeriodEnd: true,
            status: subscription.status,
          }
        : {
            cancelAtPeriodEnd: false,
            canceledAt: now,
            status: SubscriptionStatus.CANCELED,
            currentPeriodEnd: now,
          },
    });

    if (!atPeriodEnd) {
      await tx.tenant.update({
        where: { id: input.tenantId },
        data: {
          plan: Plan.MINI,
          planExpiresAt: now,
        },
      });
    }

    await tx.planHistory.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        fromPlan: subscription.plan,
        toPlan: atPeriodEnd ? subscription.plan : Plan.MINI,
        billingCycle: subscription.billingCycle,
        reason: PlanChangeReason.CANCELLATION,
        effectiveAt: atPeriodEnd ? (subscription.currentPeriodEnd || now) : now,
        actorUserId: input.actorUserId || null,
        note: input.note || (atPeriodEnd ? 'Cancellation scheduled at period end' : 'Subscription cancelled immediately'),
      },
    });

    return updated;
  });
}
