import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma, withPrismaRetry } from '../db/prisma';
import { lockSessionForMutation } from '../db/session-lock';
import { env } from '../config/env';
import { getIO, getSessionRoom, getTenantRoom } from '../socket';
import { deleteCache, withCache } from '../services/cache.service';
import { generateOrderNumber } from '../services/order-number.service';
import { buildServerPricedOrderPayload } from '../services/order-payload.service';
import { cacheKeys } from '../utils/cache-keys';
import {
  canMoveSessionToBilling,
  hasServiceInProgress,
  resolvePostPaymentSessionStatus,
} from '../utils/session-settlement';
import {
  authorizeSessionAccess,
  generateSessionAccessToken,
  readTableQrSecret,
  verifyCustomerAccessTokenFromRequest,
} from '../utils/public-access';

async function resolveTenantBySlugOrThrow(tenantSlug: string) {
  return withCache(
    cacheKeys.tenantFull(tenantSlug),
    async () =>
      withPrismaRetry(
        async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: {
          id: true,
          businessName: true,
          slug: true,
          logoUrl: true,
          taxRate: true,
          currencySymbol: true,
          address: true,
          phone: true,
          upiId: true,
          hasWaiterService: true,
          gstin: true,
          fssai: true,
          plan: true,
        },
      });

      if (!tenant) {
        throw new Error('TENANT_NOT_FOUND');
      }

      return tenant;
        },
        `session-tenant:${tenantSlug}`,
      ),
    300,
  );
}

async function invalidateSessionCaches(tenantId: string, sessionId?: string | null, orderIds: string[] = []) {
  await Promise.all([
    deleteCache(cacheKeys.dashboardLiveOrders(tenantId)),
    deleteCache(cacheKeys.dashboardOrderHistoryPattern(tenantId)),
    sessionId ? deleteCache(cacheKeys.publicSession(tenantId, sessionId)) : Promise.resolve(),
    sessionId ? deleteCache(cacheKeys.sessionOrders(tenantId, sessionId)) : Promise.resolve(),
    ...orderIds.map((orderId) => deleteCache(cacheKeys.publicOrderInfo(tenantId, orderId))),
  ]);
}

function isActiveSessionConflictError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === 'P2002' ||
    String(maybeError.message || '').includes('DiningSession_active_table_session_uidx')
  );
}

function withSessionAccessToken<T extends { id: string; tenantId: string; customerId: string; tableId?: string | null }>(
  session: T,
) {
  return {
    ...session,
    sessionAccessToken: generateSessionAccessToken({
      tenantId: session.tenantId,
      sessionId: session.id,
      customerId: session.customerId,
      tableId: session.tableId ?? null,
    }),
  };
}

type SessionOrderTotals = {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
};

function calculateSessionOrderTotals(
  orders: Array<{
    subtotal?: number | null;
    taxAmount?: number | null;
    discountAmount?: number | null;
    totalAmount?: number | null;
  }> = [],
): SessionOrderTotals {
  const subtotal = orders.reduce((sum, order) => sum + Number(order?.subtotal || 0), 0);
  const taxAmount = orders.reduce((sum, order) => sum + Number(order?.taxAmount || 0), 0);
  const discountAmount = orders.reduce((sum, order) => sum + Number(order?.discountAmount || 0), 0);
  const summedTotal = orders.reduce((sum, order) => sum + Number(order?.totalAmount || 0), 0);
  const fallbackTotal = subtotal + taxAmount - discountAmount;

  return {
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount: summedTotal > 0 ? summedTotal : Math.max(0, fallbackTotal),
  };
}

function reconcileSessionBill<
  T extends { subtotal?: number | null; taxAmount?: number | null; discountAmount?: number | null; totalAmount?: number | null } | null | undefined,
>(bill: T, totals: SessionOrderTotals): T {
  if (!bill) return bill;

  const currentSubtotal = Number(bill.subtotal || 0);
  const currentTaxAmount = Number(bill.taxAmount || 0);
  const currentDiscountAmount = Number(bill.discountAmount || 0);
  const currentTotalAmount = Number(bill.totalAmount || 0);
  const shouldRepair =
    totals.totalAmount > 0 &&
    (
      currentTotalAmount <= 0 ||
      currentSubtotal <= 0 ||
      Math.abs(currentTotalAmount - totals.totalAmount) > 0.01 ||
      Math.abs(currentSubtotal - totals.subtotal) > 0.01 ||
      Math.abs(currentTaxAmount - totals.taxAmount) > 0.01 ||
      Math.abs(currentDiscountAmount - totals.discountAmount) > 0.01
    );

  if (!shouldRepair) {
    return bill;
  }

  return {
    ...bill,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: totals.discountAmount,
    totalAmount: totals.totalAmount,
  };
}

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildUpiUri({
  upiId,
  payeeName,
  amount,
  note,
}: {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
}) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
}

const sessionSnapshotOrderItemSelect = {
  id: true,
  orderId: true,
  menuItemId: true,
  name: true,
  description: true,
  imageUrl: true,
  unitPrice: true,
  quantity: true,
  totalPrice: true,
  selectedModifiers: true,
  specialNote: true,
  isVeg: true,
  createdAt: true,
} as const;

const sessionSnapshotOrderSelect = {
  id: true,
  version: true,
  tenantId: true,
  tableId: true,
  diningSessionId: true,
  orderNumber: true,
  orderType: true,
  status: true,
  placedBy: true,
  subtotal: true,
  taxAmount: true,
  discountAmount: true,
  totalAmount: true,
  customerName: true,
  customerPhone: true,
  specialInstructions: true,
  estimatedPrepMins: true,
  acceptedAt: true,
  preparingAt: true,
  readyAt: true,
  servedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  hasReview: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: sessionSnapshotOrderItemSelect,
  },
} as const;

async function fetchSessionSnapshot(tenantId: string, sessionId: string) {
  return withCache(
    cacheKeys.publicSession(tenantId, sessionId),
    async () =>
      withPrismaRetry(
        async () => {
          const [session, orders, bill, review] = await prisma.$transaction([
            prisma.diningSession.findFirst({
              where: { id: sessionId, tenantId },
              select: {
                id: true,
                tenantId: true,
                tableId: true,
                customerId: true,
                partySize: true,
                sessionStatus: true,
                source: true,
                openedAt: true,
                closedAt: true,
                isBillGenerated: true,
                billGeneratedAt: true,
                attendedByUserId: true,
                attendedByName: true,
                table: { select: { name: true } },
                customer: { select: { id: true, name: true, phone: true } },
              },
            }),
            prisma.order.findMany({
              where: {
                tenantId,
                diningSessionId: sessionId,
                status: { not: 'CANCELLED' as any },
              },
              select: sessionSnapshotOrderSelect,
              orderBy: { createdAt: 'asc' },
            }),
            prisma.bill.findUnique({
              where: { sessionId },
              select: {
                id: true,
                tenantId: true,
                sessionId: true,
                invoiceNumber: true,
                subtotal: true,
                taxAmount: true,
                discountAmount: true,
                totalAmount: true,
                paymentStatus: true,
                paymentMethod: true,
                paidAt: true,
                generatedAt: true,
                businessName: true,
                businessAddress: true,
                gstin: true,
                fssai: true,
              },
            }),
            prisma.review.findFirst({
              where: { diningSessionId: sessionId },
              select: {
                id: true,
                overallRating: true,
                foodRating: true,
                serviceRating: true,
                comment: true,
                tipAmount: true,
                serviceStaffName: true,
                createdAt: true,
              },
            }),
          ]);

          if (!session) {
            return null;
          }

          return {
            ...session,
            orders,
            bill,
            review,
          };
        },
        `session-snapshot:${tenantId}:${sessionId}`,
      ),
    8,
  );
}

/**
 * Internal helper to transition a session to closed state.
 * Marks orders as RECEIVED, frees table, and emits sockets.
 */
/**
 * Internal helper to transition a session to closed or settled state.
 * Marks orders as RECEIVED, generates bill if missing, and optionally closes session.
 */
export async function performSessionCompletion(
  sessionId: string,
  tenantId: string,
  paymentMethod: string = 'cash',
  shouldClose: boolean = true,
  force: boolean = false,
) {
  const result = await prisma.$transaction(async (tx) => {
    await lockSessionForMutation(tx, sessionId);

    const existingSession = await tx.diningSession.findUnique({
      where: { id: sessionId },
      include: {
        orders: {
          where: { status: { notIn: ['CANCELLED'] } },
        },
        bill: true,
      },
    });

    if (!existingSession) throw new Error('SESSION_NOT_FOUND');
    if (existingSession.tenantId !== tenantId) throw new Error('SESSION_TENANT_MISMATCH');

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: {
        businessName: true,
        address: true,
        taxRate: true,
        gstin: true,
        fssai: true,
      },
    });

    if (!tenant) throw new Error('TENANT_NOT_FOUND');

    let currentSession = existingSession;
    const computedTotals = calculateSessionOrderTotals(existingSession.orders);
    const hasOrders = existingSession.orders.length > 0;
    const hasActiveService = hasServiceInProgress(existingSession.orders);
    const paymentTimestamp = new Date();

    if (existingSession.sessionStatus === 'CANCELLED') {
      throw new Error('SESSION_CANCELLED');
    }

    if (existingSession.sessionStatus === 'CLOSED') {
      return {
        ...existingSession,
        bill: reconcileSessionBill(existingSession.bill, computedTotals),
      };
    }

    if (!shouldClose && !hasOrders) {
      throw new Error('SESSION_NOT_READY_FOR_PAYMENT');
    }

    if (shouldClose && hasActiveService && !force) {
      throw new Error('SESSION_HAS_ACTIVE_ORDERS');
    }

    let billGeneratedAt = existingSession.billGeneratedAt;

    if (hasOrders) {
      const bill = await tx.bill.upsert({
        where: { sessionId },
        update: {
          subtotal: computedTotals.subtotal,
          taxAmount: computedTotals.taxAmount,
          discountAmount: computedTotals.discountAmount,
          totalAmount: computedTotals.totalAmount,
          businessName: tenant.businessName,
          businessAddress: tenant.address,
          gstin: (tenant as any).gstin,
          fssai: (tenant as any).fssai,
          paymentStatus: 'PAID',
          paymentMethod,
          paidAt: paymentTimestamp,
        } as any,
        create: {
          tenantId,
          sessionId,
          subtotal: computedTotals.subtotal,
          taxAmount: computedTotals.taxAmount,
          discountAmount: computedTotals.discountAmount,
          totalAmount: computedTotals.totalAmount,
          invoiceNumber: `INV-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
          businessName: tenant.businessName,
          businessAddress: tenant.address,
          gstin: (tenant as any).gstin,
          fssai: (tenant as any).fssai,
          paymentStatus: 'PAID',
          paymentMethod,
          paidAt: paymentTimestamp,
        } as any,
        select: {
          generatedAt: true,
        },
      });
      billGeneratedAt = bill.generatedAt;
    }

    const nextSessionStatus = resolvePostPaymentSessionStatus(
      String(existingSession.sessionStatus || 'ACTIVE'),
      existingSession.orders,
      shouldClose,
    ) as any;

    currentSession = await tx.diningSession.update({
      where: { id: sessionId },
      data: {
        isBillGenerated: hasOrders ? true : existingSession.isBillGenerated,
        billGeneratedAt: hasOrders ? billGeneratedAt : existingSession.billGeneratedAt,
        sessionStatus: nextSessionStatus,
        closedAt: shouldClose ? paymentTimestamp : existingSession.closedAt,
      },
      include: { orders: true, bill: true },
    });

    if (shouldClose) {
      await tx.order.updateMany({
        where: { diningSessionId: sessionId, status: { notIn: ['CANCELLED'] } },
        data: { status: 'RECEIVED' as any, completedAt: paymentTimestamp },
      });

      const refreshedSession = await tx.diningSession.findUnique({
        where: { id: sessionId },
        include: { orders: true, bill: true },
      });
      if (refreshedSession) {
        currentSession = refreshedSession;
      }
    }

    if (currentSession.tableId) {
      if (shouldClose) {
        await tx.table.update({
          where: { id: currentSession.tableId },
          data: { status: 'AVAILABLE', currentOrderId: null, currentSessionId: null },
        });
      } else if (nextSessionStatus === 'AWAITING_BILL') {
        await tx.table.update({
          where: { id: currentSession.tableId },
          data: { status: 'AWAITING_BILL' },
        });
      }
    }

    return currentSession;
  });

  // Socket emissions
  const tenantRoom = getTenantRoom(tenantId);
  const sessionRoom = getSessionRoom(tenantId, result.id);

  const eventType = shouldClose ? 'session:completed' : 'session:settled';
  const status = String((result as any).sessionStatus || (shouldClose ? 'CLOSED' : 'ACTIVE'));

  const payload = {
    sessionId: result.id,
    paymentMethod,
    closedAt: result.closedAt,
    status,
    totalAmount: (result as any).bill?.totalAmount,
  };

  getIO().to(tenantRoom).emit(eventType, payload);
  getIO().to(sessionRoom).emit(eventType, payload);
  
  getIO().to(tenantRoom).emit('session:update', {
    sessionId: result.id,
    status,
    updatedAt: new Date().toISOString(),
  });
  getIO().to(sessionRoom).emit('session:update', {
    sessionId: result.id,
    status,
    updatedAt: new Date().toISOString(),
  });

  if (shouldClose) {
    getIO().to(tenantRoom).emit('orders:bulk_status', {
      sessionId: result.id,
      status: 'RECEIVED',
      updatedAt: new Date().toISOString(),
    });
  }

  if (result.tableId && (shouldClose || status === 'AWAITING_BILL')) {
    getIO().to(tenantRoom).emit('table:status_change', {
      tableId: result.tableId,
      status: shouldClose ? 'AVAILABLE' : 'AWAITING_BILL',
    });
  }

  await invalidateSessionCaches(
    tenantId,
    result.id,
    Array.isArray((result as any).orders) ? (result as any).orders.map((order: { id: string }) => order.id) : [],
  );
  return result;
}

/**
 * POST /:tenantSlug/sessions
 * Create a new dining session (after login + party size)
 */
export const createSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { customerId, tableId, partySize, customerName, customerPhone } = req.body;
    const qrSecret = readTableQrSecret(req);
    const enforceTableQrSecret = Boolean(env.ENFORCE_TABLE_QR_SECRET);
    const customerClaims = verifyCustomerAccessTokenFromRequest(req);

    const normalizedPhone =
      typeof customerPhone === 'string' && customerPhone.trim().length >= 8
        ? customerPhone.trim()
        : null;
    const normalizedName =
      typeof customerName === 'string' && customerName.trim().length > 0
        ? customerName.trim()
        : null;

    if (!customerId && !normalizedPhone) {
      return res.status(400).json({ error: 'customerId or customerPhone required' });
    }
    if (!partySize || partySize < 1) return res.status(400).json({ error: 'partySize must be >= 1' });

    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const [table, existingSession] = await Promise.all([
      tableId
        ? withPrismaRetry(
            () =>
              prisma.table.findFirst({
                where: { id: tableId, tenantId: tenant.id },
                select: { id: true, capacity: true, qrSecret: true },
              }),
            `session-table:${tenant.id}:${tableId}`,
          )
        : Promise.resolve(null),
      tableId
        ? withPrismaRetry(
            () =>
              prisma.diningSession.findFirst({
                where: {
                  tableId,
                  tenantId: tenant.id,
                  sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
                },
                select: { id: true },
              }),
            `session-existing:${tenant.id}:${tableId}`,
          )
        : Promise.resolve(null),
    ]);

    if (tableId && !table) {
      return res.status(404).json({ error: 'Table not found for this restaurant' });
    }

    if (tableId && enforceTableQrSecret && !qrSecret) {
      return res.status(401).json({
        error: 'QR validation required. Please scan the table QR again.',
        code: 'QR_REQUIRED',
      });
    }

    if (tableId && table && enforceTableQrSecret && table.qrSecret !== qrSecret) {
      return res.status(403).json({
        error: 'Invalid table QR. Please scan the QR again.',
        code: 'QR_INVALID',
      });
    }

    if (existingSession) {
      return res.status(409).json({
        error: 'Table has an active session',
        existingSessionId: existingSession.id,
      });
    }

    if (table && partySize > table.capacity) {
      return res.status(400).json({
        error: 'Party size exceeds table capacity',
        maxCapacity: table.capacity,
      });
    }

    if (customerId) {
      if (!customerClaims || customerClaims.customerId !== customerId) {
        return res.status(401).json({
          error: 'Customer authentication is required before starting a session.',
        });
      }

      if (customerClaims.tenantSlug && customerClaims.tenantSlug !== tenantSlug) {
        return res.status(403).json({
          error: 'Customer token does not belong to this restaurant.',
        });
      }
    }


    // Resolve customer (robust to stale client storage)
    let resolvedCustomer = null as null | { id: string; isActive: boolean };
    if (customerId) {
      resolvedCustomer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, isActive: true },
      });
    }

    if (!resolvedCustomer && normalizedPhone) {
      resolvedCustomer = await prisma.customer.findUnique({
        where: { phone: normalizedPhone },
        select: { id: true, isActive: true },
      });
    }

    if (!resolvedCustomer && normalizedPhone) {
      resolvedCustomer = await prisma.customer.create({
        data: {
          phone: normalizedPhone,
          name: normalizedName,
        },
        select: { id: true, isActive: true },
      });
    }

    if (!resolvedCustomer) {
      return res.status(404).json({ error: 'Customer not found. Please log in again.' });
    }
    if (!resolvedCustomer.isActive) {
      return res.status(403).json({ error: 'Customer account is inactive.' });
    }

    // Create session + update table status in a transaction
    let session;
    try {
      session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.diningSession.create({
        data: {
          tenantId: tenant.id,
          tableId: tableId || null,
          customerId: resolvedCustomer!.id,
          partySize,
          sessionStatus: 'OPEN' as any,
          source: 'qr',
        },
        include: {
          table: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
        },
      });

      // Mark table as occupied
      if (tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: {
            status: 'OCCUPIED',
            currentSessionId: newSession.id,
          },
        });
      }

      return newSession;
      });
    } catch (err) {
      console.error('createSession prisma.$transaction failed', {
        tenantSlug,
        tableId,
        partySize,
        customerId,
        error: err && (err instanceof Error ? err.stack || err.message : String(err)),
      });
      if (isActiveSessionConflictError(err) && tableId) {
        const activeSession = await prisma.diningSession.findFirst({
          where: {
            tenantId: tenant.id,
            tableId,
            sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
          },
          select: { id: true },
        });

        if (activeSession) {
          return res.status(409).json({
            error: 'Table has an active session',
            existingSessionId: activeSession.id,
          });
        }
      }
      throw err;
    }

    // Notify vendor dashboard
    getIO().to(getTenantRoom(tenant.id)).emit('session:new', {
      id: session.id,
      tableId: session.tableId,
      tableName: (session as any).table?.name,
      customerName: (session as any).customer?.name,
      partySize: session.partySize,
      openedAt: session.openedAt,
    });

    // Respond immediately â€” cache cleanup runs after response is flushed
    res.status(201).json(withSessionAccessToken(session));

    setImmediate(() => {
      invalidateSessionCaches(tenant.id, session.id).catch((err) =>
        console.error('[SESSION_CACHE_INVALIDATION_ERROR]', err),
      );
    });
  } catch (error) {
    console.error('createSession error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.status(500).json({ error: 'Failed to create session' });
  }
};

/**
 * GET /:tenantSlug/sessions/:sessionId
 * Get session with all orders + running total
 */
export const getSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionId } = req.params;
    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const session = await fetchSessionSnapshot(tenant.id, sessionId);

    if (!session) return res.status(404).json({ error: 'Session not found' });
    authorizeSessionAccess(req, {
      tenantId: tenant.id,
      sessionId: session.id,
      customerId: session.customerId,
      tenantSlug,
    });

    const reconciledBill = reconcileSessionBill(session.bill, calculateSessionOrderTotals(session.orders));
    const runningTotal = reconciledBill
      ? Number(reconciledBill.totalAmount || 0)
      : session.orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
    const itemCount = session.orders.reduce(
      (sum: number, order: any) => sum + order.items.reduce((s: number, i: any) => s + i.quantity, 0),
      0
    );

    res.json(
      withSessionAccessToken({
        ...session,
        bill: reconciledBill,
        tenant: {
          businessName: tenant.businessName,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          taxRate: tenant.taxRate,
          currencySymbol: tenant.currencySymbol,
          hasWaiterService: tenant.hasWaiterService,
          upiConfigured: Boolean(tenant.upiId),
        },
        runningTotal,
        itemCount,
      }),
    );
  } catch (error) {
    console.error('getSession error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (
      error instanceof Error &&
      ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)
    ) {
      return res.status(401).json({ error: 'Session access token is required for this session.' });
    }
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

/**
 * POST /:tenantSlug/sessions/:sessionId/orders
 * Add a new order to the session
 */
export const addOrderToSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { sessionId } = req.params;
    const { items, specialInstructions, placedBy } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items required' });
    }

    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const session = await withPrismaRetry(
      () =>
        prisma.diningSession.findFirst({
          where: { id: sessionId, tenantId: tenant.id },
          select: {
            id: true,
            tenantId: true,
            tableId: true,
            customerId: true,
            sessionStatus: true,
          },
        }),
      `session-orderable:${tenant.id}:${sessionId}`,
    );

    if (!session) return res.status(404).json({ error: 'Session not found' });
    authorizeSessionAccess(req, {
      tenantId: tenant.id,
      sessionId: session.id,
      customerId: session.customerId,
      tenantSlug,
    });
    
    if (['CLOSED', 'CANCELLED', 'AWAITING_BILL'].includes(session.sessionStatus)) {
      return res.status(400).json({ error: 'Session is closed. No more orders can be added.' });
    }

    const { subtotal, orderItems } = await buildServerPricedOrderPayload(prisma, tenant.id, items);

    const taxAmount = subtotal * (tenant.taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // Generate order number â€” unified format using collision-resistant generator
    const orderNumber = generateOrderNumber('DINE_IN');

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
      await lockSessionForMutation(tx, sessionId);

      const lockedSession = await tx.diningSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          tableId: true,
          sessionStatus: true,
        },
      });

      if (!lockedSession) {
        throw new Error('SESSION_NOT_FOUND');
      }

      if (['CLOSED', 'CANCELLED', 'AWAITING_BILL'].includes(lockedSession.sessionStatus)) {
        throw new Error('SESSION_NOT_ORDERABLE');
      }

      const newOrder = await tx.order.create({
        data: {
          tenantId: tenant.id,
          tableId: lockedSession.tableId,
          diningSessionId: sessionId,
          orderNumber,
          orderType: 'DINE_IN',
          status: 'NEW' as any,
          placedBy: placedBy || 'customer',
          subtotal,
          taxAmount,
          totalAmount,
          specialInstructions,
          items: { create: orderItems },
        },
        include: {
          items: { include: { menuItem: false } },
          table: { select: { name: true } },
          diningSession: {
            include: {
              customer: true,
            },
          },
        },
      });

      // Update session status
      await tx.diningSession.update({
        where: { id: sessionId },
        data: { sessionStatus: 'ACTIVE' as any },
      });

      // Update table status
      if (lockedSession.tableId) {
        await tx.table.update({
          where: { id: lockedSession.tableId },
          data: { status: 'ORDERING_OPEN' as any, currentOrderId: newOrder.id },
        });
      }

      return newOrder;
      });
    } catch (err) {
      console.error('addOrderToSession prisma.$transaction failed', {
        tenantSlug,
        sessionId,
        itemsSummary: Array.isArray(items) ? `${items.length} items` : typeof items,
        error: err && (err instanceof Error ? err.stack || err.message : String(err)),
      });
      throw err;
    }

    // Notify vendor dashboard + KDS
    const tenantRoom = getTenantRoom(tenant.id);
    const sessionRoom = getSessionRoom(tenant.id, sessionId);
    const sessionUpdatePayload = {
      sessionId,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    getIO().to(tenantRoom).emit('order:new', order);
    getIO().to(sessionRoom).emit('order:new', order);
    getIO().to(tenantRoom).emit('session:update', sessionUpdatePayload);
    getIO().to(sessionRoom).emit('session:update', sessionUpdatePayload);
    if (order.tableId) {
      getIO().to(tenantRoom).emit('table:status_change', {
        tableId: order.tableId,
        status: 'ORDERING_OPEN',
        orderNumber: order.orderNumber,
      });
    }

    res.status(201).json(order);
    setImmediate(() => {
      invalidateSessionCaches(tenant.id, sessionId, [order.id]).catch((err) =>
        console.error('[SESSION_ORDER_CACHE_INVALIDATION_ERROR]', err),
      );
    });
  } catch (error: any) {
    console.error('addOrderToSession error:', error);
    if (error instanceof Error && (error.message === 'ORDER_ITEMS_REQUIRED' || error.message === 'ORDER_ITEMS_INVALID')) {
      return res.status(400).json({ error: 'Order items are missing or invalid. Refresh the menu and try again.' });
    }
    if (
      error instanceof Error &&
      ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)
    ) {
      return res.status(401).json({ error: 'Session access token is required to modify this session.' });
    }
    if (error instanceof Error && error.message.startsWith('MENU_ITEM_NOT_FOUND:')) {
      return res.status(400).json({ error: 'One or more items are unavailable. Refresh the menu and try again.' });
    }
    if (error instanceof Error && error.message.startsWith('MODIFIER_')) {
      return res.status(400).json({ error: 'One or more modifier selections are invalid. Review the order and try again.' });
    }
    if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (error instanceof Error && error.message === 'SESSION_NOT_ORDERABLE') {
      return res.status(409).json({ error: 'Session is no longer open for new orders. Refresh the bill or session status and try again.' });
    }
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
};

/**
 * POST /:tenantSlug/sessions/:sessionId/finish
 * Customer or vendor finishes the session â†’ generates bill
 */
export const finishSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { sessionId } = req.params;

    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);

    const session = await fetchSessionSnapshot(tenant.id, sessionId);

    if (!session) return res.status(404).json({ error: 'Session not found' });
    authorizeSessionAccess(req, {
      tenantId: tenant.id,
      sessionId: session.id,
      customerId: session.customerId,
      tenantSlug,
    });
    if (session.sessionStatus === 'AWAITING_BILL') {
      return res.json({
        ...session,
        bill: reconcileSessionBill(session.bill, calculateSessionOrderTotals(session.orders)),
      });
    }
    if (['CLOSED', 'CANCELLED'].includes(session.sessionStatus)) {
      return res.status(400).json({ error: 'Session is already closed' });
    }

    // Validate session has orders
    if (session.orders.length === 0) {
      return res.status(400).json({
        error: 'Cannot finish session with no orders',
        sessionId
      });
    }

    const hasUnservedOrders = session.orders.some(
      (order: any) => !['SERVED', 'RECEIVED'].includes(String(order.status || '').toUpperCase()),
    );
    if (hasUnservedOrders) {
      return res.status(409).json({
        error: 'Serve every active batch before generating the final bill.',
        sessionId,
      });
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
      await lockSessionForMutation(tx, sessionId);

      const lockedSession = await tx.diningSession.findUnique({
        where: { id: sessionId },
        include: {
          orders: {
            where: { status: { notIn: ['CANCELLED'] } },
            include: { items: true },
          },
        },
      });

      if (!lockedSession) {
        throw new Error('SESSION_NOT_FOUND');
      }

      if (['CLOSED', 'CANCELLED', 'AWAITING_BILL'].includes(lockedSession.sessionStatus)) {
        throw new Error('SESSION_NOT_ORDERABLE');
      }

      if (lockedSession.orders.length === 0) {
        throw new Error('SESSION_EMPTY');
      }

      const lockedHasUnservedOrders = lockedSession.orders.some(
        (order: any) => !['SERVED', 'RECEIVED'].includes(String(order.status || '').toUpperCase()),
      );
      if (lockedHasUnservedOrders) {
        throw new Error('SESSION_HAS_UNSERVED_ORDERS');
      }

      const computedTotals = calculateSessionOrderTotals(lockedSession.orders);

      const bill = await tx.bill.upsert({
        where: { sessionId },
        update: {
          subtotal: computedTotals.subtotal,
          taxAmount: computedTotals.taxAmount,
          discountAmount: computedTotals.discountAmount,
          totalAmount: computedTotals.totalAmount,
          businessName: tenant.businessName,
          businessAddress: tenant.address,
          gstin: (tenant as any).gstin,
          fssai: (tenant as any).fssai,
        } as any,
        create: {
          tenantId: tenant.id,
          sessionId,
          subtotal: computedTotals.subtotal,
          taxAmount: computedTotals.taxAmount,
          discountAmount: computedTotals.discountAmount,
          totalAmount: computedTotals.totalAmount,
          invoiceNumber: `INV-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
          businessName: tenant.businessName,
          businessAddress: tenant.address,
          gstin: (tenant as any).gstin,
          fssai: (tenant as any).fssai,
        } as any,
        select: {
          generatedAt: true,
        },
      });

      // Update session status to AWAITING_BILL regardless
      const updatedSession = await tx.diningSession.update({
        where: { id: sessionId },
        data: {
          sessionStatus: 'AWAITING_BILL' as any,
          isBillGenerated: true,
          billGeneratedAt: bill.generatedAt,
        },
        include: {
          tenant: { select: { businessName: true, currencySymbol: true } },
          table: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
          orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
          bill: true,
        },
      });


      // Update table status
      if (lockedSession.tableId) {
        await tx.table.update({
          where: { id: lockedSession.tableId },
          data: { status: 'AWAITING_BILL' },
        });
      }

      return updatedSession;
      });
    } catch (err) {
      console.error('finishSession prisma.$transaction failed', {
        tenantSlug,
        sessionId,
        error: err && (err instanceof Error ? err.stack || err.message : String(err)),
      });
      throw err;
    }

    // Notify vendor
    const tenantRoom = getTenantRoom(tenant.id);
    const sessionRoom = getSessionRoom(tenant.id, result.id);

    const finishedPayload = {
      sessionId: result.id,
      tableName: (result as any).table?.name,
      totalAmount: (result as any).bill?.totalAmount,
    };
    const sessionUpdatePayload = {
      sessionId: result.id,
      status: 'AWAITING_BILL',
      updatedAt: new Date().toISOString(),
    };

    getIO().to(tenantRoom).emit('session:finished', finishedPayload);
    getIO().to(sessionRoom).emit('session:finished', finishedPayload);
    getIO().to(tenantRoom).emit('session:update', sessionUpdatePayload);
    getIO().to(sessionRoom).emit('session:update', sessionUpdatePayload);
    if (result.tableId) {
      getIO().to(tenantRoom).emit('table:status_change', {
        tableId: result.tableId,
        status: 'AWAITING_BILL',
      });
    }

    await invalidateSessionCaches(tenant.id, result.id);

    res.json(result);
  } catch (error) {
    console.error('finishSession error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (error instanceof Error && error.message === 'SESSION_NOT_ORDERABLE') {
      return res.status(409).json({ error: 'Session is no longer open for bill generation.' });
    }
    if (error instanceof Error && error.message === 'SESSION_EMPTY') {
      return res.status(400).json({ error: 'Cannot finish session with no orders' });
    }
    if (error instanceof Error && error.message === 'SESSION_HAS_UNSERVED_ORDERS') {
      return res.status(409).json({ error: 'Serve every active batch before generating the final bill.' });
    }
    if (
      error instanceof Error &&
      ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)
    ) {
      return res.status(401).json({ error: 'Session access token is required to finish this session.' });
    }
    res.status(500).json({ error: 'Failed to finish session' });
  }
};

/**
 * POST /:tenantSlug/sessions/:sessionId/complete
 * Mark session as fully completed (after payment)
 */
export const completeSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionId } = req.params;
    const requestedPaymentMethod = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod.toLowerCase() : 'cash';
    const shouldClose = req.body?.shouldClose !== undefined ? Boolean(req.body.shouldClose) : true;
    const force = Boolean(req.body?.force);
    
    const allowedPaymentMethods = new Set(['cash', 'online', 'upi', 'card', 'other']);

    if (!allowedPaymentMethods.has(requestedPaymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const result = await performSessionCompletion(sessionId, tenant.id, requestedPaymentMethod, shouldClose, force);

    res.json(result);
  } catch (error) {
    console.error('completeSession error:', error);
    if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (error instanceof Error && error.message === 'SESSION_TENANT_MISMATCH') {
      return res.status(403).json({ error: 'Session does not belong to this restaurant' });
    }
    if (error instanceof Error && error.message === 'SESSION_NOT_READY_FOR_PAYMENT') {
      return res.status(409).json({ error: 'Generate the final bill before marking payment complete.' });
    }
    if (error instanceof Error && error.message === 'SESSION_HAS_ACTIVE_ORDERS') {
      return res.status(409).json({ error: 'Active service is still in progress. Finish service or force archive to close this session.' });
    }
    if (error instanceof Error && error.message === 'SESSION_CANCELLED') {
      return res.status(409).json({ error: 'Cancelled sessions cannot be marked as paid.' });
    }
    res.status(500).json({ error: 'Failed to complete session' });
  }
};

export const requestSessionPayment = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionId } = req.params;
    const requestedMethod = readOptionalString(req.body?.method)?.toLowerCase();

    if (!requestedMethod || !['cash', 'online'].includes(requestedMethod)) {
      return res.status(400).json({ error: 'Choose cash or online payment.' });
    }

    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const session = await fetchSessionSnapshot(tenant.id, sessionId);

    if (!session) return res.status(404).json({ error: 'Session not found' });

    authorizeSessionAccess(req, {
      tenantId: tenant.id,
      sessionId: session.id,
      customerId: session.customerId,
      tenantSlug,
    });

    if (!session.bill || session.sessionStatus !== 'AWAITING_BILL') {
      return res.status(409).json({ error: 'The restaurant must finish service and prepare the final bill before checkout.' });
    }

    if (String(session.bill.paymentStatus || '').toUpperCase() === 'PAID') {
      return res.json(
        withSessionAccessToken({
          ...session,
          tenant: {
            businessName: tenant.businessName,
            slug: tenant.slug,
            currencySymbol: tenant.currencySymbol,
            taxRate: tenant.taxRate,
            address: tenant.address,
            phone: tenant.phone,
            hasWaiterService: tenant.hasWaiterService,
            upiConfigured: Boolean(tenant.upiId),
          },
          bill: reconcileSessionBill(session.bill, calculateSessionOrderTotals(session.orders)),
        }),
      );
    }

    const totals = calculateSessionOrderTotals(session.orders);
    const reconciledBill = reconcileSessionBill(session.bill, totals);
    const totalAmount = Number(reconciledBill?.totalAmount || totals.totalAmount || 0);

    if (requestedMethod === 'online' && !tenant.upiId) {
      return res.status(409).json({
        error: 'Online payment is not available yet. Please ask the restaurant to configure a UPI ID first.',
      });
    }

    await withPrismaRetry(
      () =>
        prisma.bill.update({
          where: { sessionId },
          data: {
            paymentMethod: requestedMethod,
          },
        }),
      `session-payment-request:${tenant.id}:${sessionId}`,
    );

    // C-1: Move cache invalidation BEFORE emission to prevent stale fetch race conditions
    await Promise.all([
      deleteCache(cacheKeys.publicSession(tenant.id, session.id)),
      deleteCache(cacheKeys.dashboardLiveOrders(tenant.id)),
    ]);

    const tenantRoom = getTenantRoom(tenant.id);

    const sessionRoom = getSessionRoom(tenant.id, session.id);
    const payload = {
      sessionId: session.id,
      status: session.sessionStatus,
      paymentMethod: requestedMethod,
      tableId: session.tableId,
      tableName: session.table?.name,
      updatedAt: new Date().toISOString()
    };

    getIO().to(tenantRoom).emit('session:update', payload);
    getIO().to(sessionRoom).emit('session:update', payload);

    // C-2: Emit specific payment request event for vendor notifications
    getIO().to(tenantRoom).emit('session:payment_requested', payload);

    const paymentLink =
      requestedMethod === 'online' && tenant.upiId
        ? {
            sessionId: session.id,
            method: 'online' as const,
            amount: totalAmount,
            upiId: tenant.upiId,
            upiUri: buildUpiUri({
              upiId: tenant.upiId,
              payeeName: tenant.businessName || 'Restaurant',
              amount: totalAmount,
              note: reconciledBill?.invoiceNumber
                ? `Bill ${reconciledBill.invoiceNumber}`
                : `Session ${session.id.slice(-6).toUpperCase()}`,
            }),
          }
        : null;

    if (paymentLink) {
      getIO().to(sessionRoom).emit('session:payment_link', {
        ...paymentLink,
        createdAt: new Date().toISOString(),
      });
    }

    await invalidateSessionCaches(
      tenant.id,
      session.id,
      Array.isArray(session.orders) ? session.orders.map((order: { id: string }) => order.id) : [],
    );

    res.json(
      withSessionAccessToken({
        ...session,
        tenant: {
          businessName: tenant.businessName,
          slug: tenant.slug,
          currencySymbol: tenant.currencySymbol,
          taxRate: tenant.taxRate,
          address: tenant.address,
          phone: tenant.phone,
          hasWaiterService: tenant.hasWaiterService,
          upiConfigured: Boolean(tenant.upiId),
        },
        bill: {
          ...reconciledBill,
          paymentMethod: requestedMethod,
        },
        paymentLink,
      }),
    );
  } catch (error) {
    console.error('requestSessionPayment error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (
      error instanceof Error &&
      ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)
    ) {
      return res.status(401).json({ error: 'Session access token is required for checkout.' });
    }
    res.status(500).json({ error: 'Failed to request payment' });
  }
};

export const sendSessionPaymentLink = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionId } = req.params;
    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const upiId = readOptionalString(req.body?.upiId) || tenant.upiId;

    if (!upiId || !/^[a-z0-9.\-_]{2,}@[a-z][a-z0-9.-]{1,}$/i.test(upiId)) {
      return res.status(400).json({ error: 'Save a valid UPI ID in business settings before sending payment links.' });
    }

    const session = await fetchSessionSnapshot(tenant.id, sessionId);

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.bill || session.sessionStatus !== 'AWAITING_BILL') {
      return res.status(409).json({ error: 'Generate the final bill before sending a payment link.' });
    }

    const totals = calculateSessionOrderTotals(session.orders);
    const reconciledBill = reconcileSessionBill(session.bill, totals);
    const amount = Number(reconciledBill?.totalAmount || totals.totalAmount || 0);

    if (amount <= 0) {
      return res.status(400).json({ error: 'Bill total must be greater than zero before requesting payment.' });
    }

    await withPrismaRetry(
      () =>
        prisma.bill.update({
          where: { sessionId },
          data: {
            paymentMethod: 'online',
          },
        }),
      `session-payment-link:${tenant.id}:${sessionId}`,
    );

    const upiUri = buildUpiUri({
      upiId,
      payeeName: tenant.businessName || 'Restaurant',
      amount,
      note: reconciledBill?.invoiceNumber ? `Bill ${reconciledBill.invoiceNumber}` : `Session ${session.id.slice(-6).toUpperCase()}`,
    });

    const payload = {
      sessionId: session.id,
      method: 'online' as const,
      amount,
      upiId,
      upiUri,
      createdAt: new Date().toISOString(),
    };

    const tenantRoom = getTenantRoom(tenant.id);
    const sessionRoom = getSessionRoom(tenant.id, session.id);
    getIO().to(sessionRoom).emit('session:payment_link', payload);
    getIO().to(tenantRoom).emit('session:update', {
      sessionId: session.id,
      status: session.sessionStatus,
      updatedAt: new Date().toISOString(),
    });

    await invalidateSessionCaches(
      tenant.id,
      session.id,
      Array.isArray(session.orders) ? session.orders.map((order: { id: string }) => order.id) : [],
    );

    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('sendSessionPaymentLink error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.status(500).json({ error: 'Failed to send payment link' });
  }
};

export const submitSessionPayment = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionId } = req.params;
    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const session = await fetchSessionSnapshot(tenant.id, sessionId);

    if (!session) return res.status(404).json({ error: 'Session not found' });

    authorizeSessionAccess(req, {
      tenantId: tenant.id,
      sessionId: session.id,
      customerId: session.customerId,
      tenantSlug,
    });

    if (!session.bill || session.sessionStatus !== 'AWAITING_BILL') {
      return res.status(409).json({ error: 'This session is not ready for payment confirmation yet.' });
    }

    if (String(session.bill.paymentStatus || '').toUpperCase() === 'PAID') {
      return res.json({ success: true, sessionId: session.id, alreadySettled: true });
    }

    const totals = calculateSessionOrderTotals(session.orders);
    const reconciledBill = reconcileSessionBill(session.bill, totals);
    const payload = {
      sessionId: session.id,
      tableId: session.tableId || null,
      tableName: session.table?.name || undefined,
      method: String(reconciledBill?.paymentMethod || 'online'),
      totalAmount: Number(reconciledBill?.totalAmount || totals.totalAmount || 0),
      submittedAt: new Date().toISOString(),
    };

    const tenantRoom = getTenantRoom(tenant.id);
    const sessionRoom = getSessionRoom(tenant.id, session.id);
    // C-3: Move cache invalidation BEFORE emission
    await Promise.all([
      deleteCache(cacheKeys.publicSession(tenant.id, session.id)),
      deleteCache(cacheKeys.dashboardLiveOrders(tenant.id)),
    ]);

    getIO().to(tenantRoom).emit('session:payment_submitted', payload);
    getIO().to(sessionRoom).emit('session:payment_submitted', payload);

    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('submitSessionPayment error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (
      error instanceof Error &&
      ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)
    ) {
      return res.status(401).json({ error: 'Session access token is required for this payment step.' });
    }
    res.status(500).json({ error: 'Failed to notify the restaurant about your payment.' });
  }
};

export const rejectSessionPayment = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionId } = req.params;
    const message =
      readOptionalString(req.body?.message) ||
      'Payment is not visible yet. Please show it to the desk manager.';

    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const session = await fetchSessionSnapshot(tenant.id, sessionId);

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.bill) {
      return res.status(404).json({ error: 'Bill not generated yet' });
    }

    const totals = calculateSessionOrderTotals(session.orders);
    const reconciledBill = reconcileSessionBill(session.bill, totals);
    const payload = {
      sessionId: session.id,
      method: String(reconciledBill?.paymentMethod || 'online'),
      totalAmount: Number(reconciledBill?.totalAmount || totals.totalAmount || 0),
      message,
      rejectedAt: new Date().toISOString(),
    };

    getIO().to(getSessionRoom(tenant.id, session.id)).emit('session:payment_rejected', payload);
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('rejectSessionPayment error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.status(500).json({ error: 'Failed to notify the guest about payment verification.' });
  }
};

/**
 * GET /:tenantSlug/sessions/:sessionId/bill
 * Get the generated bill for a session
 */
export const getBill = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionId } = req.params;
    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);
    const session = await fetchSessionSnapshot(tenant.id, sessionId);

    if (!session) return res.status(404).json({ error: 'Session not found' });
    authorizeSessionAccess(req, {
      tenantId: tenant.id,
      sessionId: session.id,
      customerId: session.customerId,
      tenantSlug,
    });
    if (!session.bill) return res.status(404).json({ error: 'Bill not generated yet' });

    res.json(
      withSessionAccessToken({
        ...session,
        tenant: {
          businessName: tenant.businessName,
          slug: tenant.slug,
          currencySymbol: tenant.currencySymbol,
          taxRate: tenant.taxRate,
          address: tenant.address,
          phone: tenant.phone,
          hasWaiterService: tenant.hasWaiterService,
          upiConfigured: Boolean(tenant.upiId),
        },
        bill: reconcileSessionBill(session.bill, calculateSessionOrderTotals(session.orders)),
      }),
    );
  } catch (error) {
    console.error('getBill error:', error);
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (
      error instanceof Error &&
      ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)
    ) {
      return res.status(401).json({ error: 'Session access token is required for this bill.' });
    }
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
};

/**
 * GET /:tenantSlug/tables/:tableId/active-session
 * Check if a table has an active session
 */
export const getActiveSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, tableId } = req.params;
    const qrSecret = readTableQrSecret(req);
    const enforceTableQrSecret = Boolean(env.ENFORCE_TABLE_QR_SECRET);

    const tenant = await resolveTenantBySlugOrThrow(tenantSlug);

    const table = await withPrismaRetry(
      () =>
        prisma.table.findFirst({
          where: { id: tableId, tenantId: tenant.id },
          select: { id: true, qrSecret: true },
        }),
      `active-session-table:${tenant.id}:${tableId}`,
    );

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (enforceTableQrSecret && (!qrSecret || table.qrSecret !== qrSecret)) {
      return res.status(401).json({ error: 'Valid table QR is required.' });
    }

    const session = await withPrismaRetry(
      () =>
        prisma.diningSession.findFirst({
          where: {
            tableId: table.id,
            tenantId: tenant.id,
            sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
          },
          include: {
            customer: { select: { id: true, name: true } },
            table: { select: { name: true } },
          },
        }),
      `active-session:${tenant.id}:${table.id}`,
    );

    res.json({ activeSession: session || null });
  } catch (error) {
    console.error('getActiveSession error:', error);
    res.status(500).json({ error: 'Failed to check active session' });
  }
};

/**
 * POST /:tenantSlug/sessions/:sessionId/admin-finish
 * Vendor forcibly finishes the session â†’ generates bill bypassing unserved orders/minimum orders count.
 */
export const adminFinishSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const tenantId = req.tenantId; // From auth middleware
    const force = Boolean(req.body?.force);

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const session = await prisma.diningSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        tenant: true,
        bill: true,
        orders: {
          where: { status: { notIn: ['CANCELLED'] } },
          include: { items: true },
        },
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.sessionStatus === 'AWAITING_BILL') {
      return res.json({
        ...session,
        bill: reconcileSessionBill(session.bill, calculateSessionOrderTotals(session.orders)),
      });
    }
    if (['CLOSED', 'CANCELLED'].includes(session.sessionStatus)) {
      return res.status(400).json({ error: 'Session is already closed or awaiting payment' });
    }

    if (!force && session.orders.length === 0) {
      return res.status(400).json({ error: 'Cannot move this session to billing with no orders.' });
    }

    if (!force) {
      const hasUnservedOrders = session.orders.some(
        (order: any) => !['SERVED', 'RECEIVED'].includes(String(order.status || '').toUpperCase()),
      );
      if (hasUnservedOrders) {
        return res.status(409).json({ error: 'Serve every active batch before moving this session to billing.' });
      }
    }

    // Vendors can still override served-order checks when force=true.
    const computedTotals = calculateSessionOrderTotals(session.orders);

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        await lockSessionForMutation(tx, sessionId);

        const bill = await tx.bill.upsert({
          where: { sessionId },
          update: {
            subtotal: computedTotals.subtotal,
            taxAmount: computedTotals.taxAmount,
            discountAmount: computedTotals.discountAmount,
            totalAmount: computedTotals.totalAmount,
            businessName: session.tenant.businessName,
            businessAddress: session.tenant.address,
            gstin: (session.tenant as any).gstin,
            fssai: (session.tenant as any).fssai,
          } as any,
          create: {
            tenantId: session.tenantId,
            sessionId,
            subtotal: computedTotals.subtotal,
            taxAmount: computedTotals.taxAmount,
            discountAmount: computedTotals.discountAmount,
            totalAmount: computedTotals.totalAmount,
            invoiceNumber: `INV-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
            businessName: session.tenant.businessName,
            businessAddress: session.tenant.address,
            gstin: (session.tenant as any).gstin,
            fssai: (session.tenant as any).fssai,
          } as any,
          select: {
            generatedAt: true,
          },
        });

        const updatedSession = await tx.diningSession.update({
          where: { id: sessionId },
          data: {
            sessionStatus: 'AWAITING_BILL' as any,
            isBillGenerated: true,
            billGeneratedAt: bill.generatedAt,
          },
          include: {
            tenant: { select: { businessName: true, currencySymbol: true } },
            table: { select: { name: true } },
            customer: { select: { name: true, phone: true } },
            orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
            bill: true,
          },
        });

        if (session.tableId) {
          await tx.table.update({
            where: { id: session.tableId },
            data: { status: 'AWAITING_BILL' },
          });
        }

        return updatedSession;
      });
    } catch (err) {
      console.error('adminFinishSession prisma.$transaction failed', err);
      throw err;
    }

    // Notify vendors
    const tenantRoom = getTenantRoom(session.tenantId);
    const sessionRoom = getSessionRoom(session.tenantId, result.id);

    const finishedPayload = {
      sessionId: result.id,
      tableName: (result as any).table?.name,
      totalAmount: (result as any).bill?.totalAmount,
    };

    const sessionUpdatePayload = {
      sessionId: result.id,
      status: 'AWAITING_BILL',
      updatedAt: new Date().toISOString(),
    };

    getIO().to(tenantRoom).emit('session:finished', finishedPayload);
    getIO().to(sessionRoom).emit('session:finished', finishedPayload);
    getIO().to(tenantRoom).emit('session:update', sessionUpdatePayload);
    getIO().to(sessionRoom).emit('session:update', sessionUpdatePayload);
    
    if (result.tableId) {
      getIO().to(tenantRoom).emit('table:status_change', {
        tableId: result.tableId,
        status: 'AWAITING_BILL',
      });
    }

    setImmediate(() => {
      invalidateSessionCaches(session.tenantId, result.id).catch(err => 
        console.error('[ADMIN_FINISH_CACHE_ERROR]', err)
      );
    });

    res.json(result);
  } catch (error) {
    console.error('adminFinishSession error:', error);
    res.status(500).json({ error: 'Failed to finish session via admin authority' });
  }
};
