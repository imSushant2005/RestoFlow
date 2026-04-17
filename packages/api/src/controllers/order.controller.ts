import { Request, Response } from 'express';
import { UserRole } from '@dineflow/prisma';
import { prisma, withPrismaRetry } from '../db/prisma';
import { getIO, getRoleRoom, getSessionRoom, getTenantRoom } from '../socket';
import { deleteCache, withCache } from '../services/cache.service';
import { transitionOrderStatus, ConflictError } from '../services/order.service';

const VALID_ORDER_STATUSES = new Set([
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'SERVED',
  'RECEIVED',
  'CANCELLED',
]);
const ASSISTED_FULFILLMENT_MODES = new Set(['SEND_TO_KITCHEN', 'DIRECT_BILL']);
const ASSISTED_PAYMENT_METHODS = new Set(['cash', 'upi', 'card', 'online']);
const LIVE_ORDERS_CACHE_TTL_SECONDS = 3;
const ORDER_HISTORY_CACHE_TTL_SECONDS = 15;

const ROLE_ALLOWED_STATUS_UPDATES: Record<UserRole, Set<string>> = {
  OWNER: new Set(VALID_ORDER_STATUSES),
  MANAGER: new Set(VALID_ORDER_STATUSES),
  KITCHEN: new Set(['ACCEPTED', 'PREPARING', 'READY']),
  CASHIER: new Set(VALID_ORDER_STATUSES),
  WAITER: new Set(['SERVED']),
};

const leanOrderItemSelect = {
  id: true,
  name: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  specialNote: true,
  selectedModifiers: true,
} as const;

const orderItemSelect = {
  ...leanOrderItemSelect,
  menuItem: {
    select: {
      id: true,
      name: true,
      price: true,
    },
  },
} as const;

const LIVE_ORDERS_SELECT = {
  id: true,
  tenantId: true,
  tableId: true,
  diningSessionId: true,
  orderNumber: true,
  orderType: true,
  status: true,
  placedBy: true,
  customerName: true,
  customerPhone: true,
  specialInstructions: true,
  estimatedPrepMins: true,
  acceptedAt: true,
  preparingAt: true,
  readyAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  table: {
    select: {
      id: true,
      name: true,
      zone: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  diningSession: {
    select: {
      id: true,
      openedAt: true,
      sessionStatus: true,
      isBillGenerated: true,
      bill: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paymentStatus: true,
          paymentMethod: true,
          paidAt: true,
        },
      },
    },
  },
  items: {
    select: leanOrderItemSelect,
  },
} as const;

const HISTORY_ORDERS_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  customerName: true,
  diningSessionId: true,
  version: true,
  createdAt: true,
  completedAt: true,
  cancelledAt: true,
  table: {
    select: {
      id: true,
      name: true,
    },
  },
  diningSession: {
    select: {
      id: true,
      sessionStatus: true,
      isBillGenerated: true,
      bill: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paymentStatus: true,
          paymentMethod: true,
          paidAt: true,
        },
      },
    },
  },
  items: {
    select: orderItemSelect,
  },
} as const;

const orderSelect = {
  id: true,
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
  version: true,
  table: {
    select: {
      id: true,
      name: true,
      zone: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  diningSession: {
    select: {
      id: true,
      openedAt: true,
      sessionStatus: true,
      partySize: true,
      attendedByUserId: true,
      attendedByName: true,
      bill: {
        select: {
          invoiceNumber: true,
          paymentStatus: true,
          paymentMethod: true,
          paidAt: true,
          totalAmount: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  },
  items: {
    select: orderItemSelect,
  },
} as const;

function getTodayStart() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildWaiterPickupPayload(order: {
  id: string;
  orderNumber: string;
  orderType: string | null;
  readyAt?: Date | null;
  createdAt: Date;
  table?: { name?: string | null; zone?: { name?: string | null } | null } | null;
  items?: Array<{ quantity?: number | null }>;
}) {
  const tableName = order.table?.name || null;
  const zoneName = order.table?.zone?.name || null;
  const orderType = String(order.orderType || '').toUpperCase();
  const destinationLabel =
    orderType === 'TAKEAWAY'
      ? 'Takeaway Pack'
      : [tableName ? `Table ${tableName}` : null, zoneName ? `Zone ${zoneName}` : null]
          .filter(Boolean)
          .join(' • ') || 'Dining Service';

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    tableName,
    zoneName,
    destinationLabel,
    orderType,
    itemCount: (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    readyAt: order.readyAt || order.createdAt,
  };
}

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\s+/g, '').trim();
}

async function resolveStaffName(db: any, userId?: string) {
  if (!userId) return 'Staff';
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return user?.name?.trim() || 'Staff';
}

async function generateOrderNumberForTenant(tenantId: string, orderType?: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const countForDay = await prisma.order.count({
    where: {
      tenantId,
      createdAt: { gte: startOfDay },
    },
  });

  const nextNumber = countForDay + 1;
  const uppercaseType = String(orderType || '').toUpperCase();
  
  let prefix = 'T-'; // Default Takeaway
  if (uppercaseType === 'DINE_IN') prefix = 'D-';
  else if (uppercaseType === 'ZOMATO') prefix = 'Z-';
  else if (uppercaseType === 'SWIGGY') prefix = 'S-';

  return `${prefix}${nextNumber}`;
}

async function buildServerPricedOrderPayload(db: any, tenantId: string, items: any[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('ORDER_ITEMS_REQUIRED');
  }

  const normalizedItems = items.map((item) => ({
    menuItemId: String(item?.menuItemId || item?.menuItem?.id || '').trim(),
    quantity: Math.max(1, Number(item?.quantity) || 1),
    notes: typeof item?.notes === 'string' ? item.notes.trim() : typeof item?.specialNote === 'string' ? item.specialNote.trim() : '',
    selectedModifierIds: Array.from(
      new Set(
        (Array.isArray(item?.selectedModifierIds)
          ? item.selectedModifierIds
          : Array.isArray(item?.selectedModifiers)
            ? item.selectedModifiers.map((modifier: any) => modifier?.id)
            : Array.isArray(item?.modifiers)
              ? item.modifiers.map((modifier: any) => modifier?.id)
              : []
        )
          .map((value: any) => String(value || '').trim())
          .filter(Boolean),
      ),
    ),
  }));

  if (normalizedItems.some((item) => !item.menuItemId)) {
    throw new Error('ORDER_ITEMS_INVALID');
  }

  const menuItems: any[] = await db.menuItem.findMany({
    where: {
      tenantId,
      isAvailable: true,
      id: { in: normalizedItems.map((item) => item.menuItemId) },
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      images: true,
      isVeg: true,
      modifierGroups: {
        select: {
          id: true,
          name: true,
          isRequired: true,
          minSelections: true,
          maxSelections: true,
          modifiers: {
            where: { isAvailable: true },
            select: {
              id: true,
              name: true,
              priceAdjustment: true,
            },
          },
        },
      },
    },
  });

  const menuMap = new Map<string, any>(menuItems.map((menuItem: any) => [menuItem.id, menuItem]));
  let subtotal = 0;

  const orderItems = normalizedItems.map((item) => {
    const menuItem = menuMap.get(item.menuItemId);
    if (!menuItem) {
      throw new Error(`MENU_ITEM_NOT_FOUND:${item.menuItemId}`);
    }

    const availableModifierIds = new Set(
      (menuItem.modifierGroups || []).flatMap((group: any) => (group.modifiers || []).map((modifier: any) => modifier.id)),
    );

    if (item.selectedModifierIds.some((modifierId) => !availableModifierIds.has(modifierId))) {
      throw new Error(`MODIFIER_NOT_FOUND:${menuItem.id}`);
    }

    let unitPrice = Number(menuItem.price || 0);
    const selectedModifiers: Array<{ id: string; name: string; groupName: string; priceAdjustment: number }> = [];

    for (const group of menuItem.modifierGroups || []) {
      const groupMinSelections = Math.max(0, Number(group.minSelections || 0));
      const groupMaxSelections = Math.max(1, Number(group.maxSelections || 1));
      const groupSelections = (group.modifiers || []).filter((modifier: any) => item.selectedModifierIds.includes(modifier.id));

      if (groupSelections.length < groupMinSelections) {
        throw new Error(`MODIFIER_REQUIRED:${group.name}`);
      }

      if (groupSelections.length > groupMaxSelections) {
        throw new Error(`MODIFIER_LIMIT:${group.name}`);
      }

      groupSelections.forEach((modifier: any) => {
        const priceAdjustment = Number(modifier.priceAdjustment || 0);
        unitPrice += priceAdjustment;
        selectedModifiers.push({
          id: modifier.id,
          name: modifier.name,
          groupName: group.name,
          priceAdjustment,
        });
      });
    }

    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;

    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      description: menuItem.description || '',
      imageUrl: menuItem.images?.[0] || null,
      unitPrice,
      quantity: item.quantity,
      totalPrice,
      selectedModifiers,
      specialNote: item.notes || null,
      isVeg: menuItem.isVeg,
    };
  });

  return {
    subtotal,
    orderItems,
  };
}

function getLiveOrdersCacheKey(tenantId: string) {
  return `dashboard_live_orders_${tenantId}`;
}

function getOrderHistoryCacheKey(tenantId: string, page: number, limit: number, statusKey: string) {
  return `dashboard_order_history_${tenantId}_${page}_${limit}_${statusKey}`;
}

async function invalidateDashboardOrderCaches(tenantId: string) {
  await Promise.all([
    deleteCache(getLiveOrdersCacheKey(tenantId)),
    deleteCache(`dashboard_order_history_${tenantId}_*`),
  ]);
}

export const getOrders = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const orders = await withCache(
      getLiveOrdersCacheKey(tenantId),
      () =>
        withPrismaRetry(
          () =>
            prisma.order.findMany({
              where: {
                tenantId,
                status: { notIn: ['RECEIVED' as any, 'CANCELLED' as any] },
              },
              select: LIVE_ORDERS_SELECT,
              orderBy: { createdAt: 'asc' },
            }),
          `dashboard-live-orders:${tenantId}`,
        ),
      LIVE_ORDERS_CACHE_TTL_SECONDS,
    );
    res.json(orders);
  } catch (error) {
    console.error('getOrders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

export const getOrderHistory = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const statusQuery = (req.query.status as string | undefined)?.toUpperCase();
    const skip = (page - 1) * limit;
    const statusFilter =
      statusQuery === 'RECEIVED' || statusQuery === 'CANCELLED'
        ? { in: [statusQuery] as Array<any> }
        : { in: ['RECEIVED', 'CANCELLED'] as Array<any> };
    const historyCacheKey = getOrderHistoryCacheKey(req.tenantId!, page, limit, statusQuery || 'terminal');

    const whereClause = {
      tenantId: req.tenantId,
      status: statusFilter,
      createdAt: {
        gte: getTodayStart(),
      },
    };

    const { orders, total } = await withCache(
      historyCacheKey,
      async () => {
        const [orders, total] = await Promise.all([
          withPrismaRetry(
            () =>
              prisma.order.findMany({
                where: whereClause,
                select: HISTORY_ORDERS_SELECT,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
              }),
            `dashboard-order-history:${req.tenantId}:orders`,
          ),
          withPrismaRetry(
            () =>
              prisma.order.count({
                where: whereClause,
              }),
            `dashboard-order-history:${req.tenantId}:count`,
          ),
        ]);

        return { orders, total };
      },
      ORDER_HISTORY_CACHE_TTL_SECONDS,
    );

    res.json({
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getOrderHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
};

export const getOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const order = await withPrismaRetry(
      () =>
        prisma.order.findUnique({
          where: { id, tenantId },
          select: orderSelect,
        }),
      `dashboard-get-order:${id}`,
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('getOrder error:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const normalizedStatus = typeof req.body?.status === 'string' ? req.body.status.toUpperCase() : '';
    const { cancelReason } = req.body;

    if (!VALID_ORDER_STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const role = req.user?.role as UserRole | undefined;
    if (!role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const allowedStatuses = ROLE_ALLOWED_STATUS_UPDATES[role];
    if (!allowedStatuses || !allowedStatuses.has(normalizedStatus)) {
      return res.status(403).json({ error: `Role ${role} cannot set status to ${normalizedStatus}` });
    }

    const existingOrder = await prisma.order.findFirst({
      where: { id, tenantId: req.tenantId },
      select: {
        id: true,
        tableId: true,
        diningSessionId: true,
        customerPhone: true,
        customerName: true,
        orderNumber: true,
        version: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (existingOrder.diningSessionId && normalizedStatus === 'RECEIVED') {
      return res.status(409).json({
        error: 'Session orders are settled when the final bill is paid.',
      });
    }

    const transitionAt = new Date();
    const statusPatch: {
      acceptedAt?: Date;
      preparingAt?: Date;
      readyAt?: Date;
      servedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
      cancellationReason?: string | null;
    } = {};

    if (normalizedStatus === 'RECEIVED') statusPatch.completedAt = transitionAt;
    if (normalizedStatus === 'CANCELLED') {
      statusPatch.cancelledAt = transitionAt;
      statusPatch.cancellationReason =
        typeof cancelReason === 'string' && cancelReason.trim().length > 0 ? cancelReason.trim() : null;
    }
    if (normalizedStatus === 'ACCEPTED') statusPatch.acceptedAt = transitionAt;
    if (normalizedStatus === 'PREPARING') statusPatch.preparingAt = transitionAt;
    if (normalizedStatus === 'READY') statusPatch.readyAt = transitionAt;
    if (normalizedStatus === 'SERVED') statusPatch.servedAt = transitionAt;

    const attendingStaffName =
      normalizedStatus === 'SERVED' && existingOrder.diningSessionId && req.user?.id
        ? (
            await prisma.user.findUnique({
              where: { id: req.user.id },
              select: { name: true },
            })
          )?.name?.trim() || 'Service Staff'
        : null;

    // Use the OCC state machine transition service
    let order;
    try {
      const expectedVersion = typeof req.body.version === 'number' ? req.body.version : existingOrder.version;
      const metadata = {
        sourceIp: req.ip,
        userAgent: req.get('user-agent'),
      };
      
      order = await transitionOrderStatus({
        orderId: existingOrder.id,
        tenantId: req.tenantId!,
        expectedVersion,
        newStatus: normalizedStatus as any,
        actorId: req.user!.id,
        actorType: 'USER',
        deviceId: req.headers['x-device-id'] as string | undefined,
        reasonCode: cancelReason,
        metadata,
        statusPatch,
      });
      
      // Secondary update for DiningSession if SERVED
      if (normalizedStatus === 'SERVED' && existingOrder.diningSessionId && req.user?.id) {
        await prisma.diningSession.update({
          where: { id: existingOrder.diningSessionId },
          data: {
            attendedByUserId: req.user.id,
            attendedByName: attendingStaffName,
          },
        });
      }
    } catch (err: any) {
      if (err instanceof ConflictError || err.message === 'OCC_COLLISION') {
        const truth = await prisma.order.findFirst({
          where: { id: existingOrder.id, tenantId: req.tenantId },
          select: orderSelect
        });
        return res.status(409).json({
          error: 'OCC_CONFLICT',
          message: 'Order status was modified by another user. Syncing...',
          recovery: { truth }
        });
      }
      throw err;
    }

    const tenantRoom = getTenantRoom(req.tenantId!);
    getIO().to(tenantRoom).emit('order:update', order);
    if (order.diningSessionId) {
      getIO().to(getSessionRoom(req.tenantId!, order.diningSessionId)).emit('order:update', order);
      getIO().to(tenantRoom).emit('session:update', {
        sessionId: order.diningSessionId,
        status: order.status,
        updatedAt: new Date().toISOString(),
      });
    }
    if (normalizedStatus === 'READY') {
      getIO().to(getRoleRoom(req.tenantId!, 'WAITER')).emit('waiter:pickup_ready', buildWaiterPickupPayload(order));
    }

    // Respond immediately — cache invalidation runs async after response is flushed
    res.json(order);

    setImmediate(() => {
      invalidateDashboardOrderCaches(req.tenantId!).catch((err) =>
        console.error('[CACHE_INVALIDATION_ERROR]', err)
      );
    });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const lookupAssistedCustomer = async (req: Request, res: Response) => {
  try {
    const phone = normalizePhone(req.query.phone);
    if (phone.length < 10) {
      return res.status(400).json({ error: 'A valid mobile number is required for lookup.' });
    }

    const customer = await prisma.customer.findUnique({
      where: { phone },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        lastSeenAt: true,
      },
    });

    if (!customer) {
      return res.json({ customer: null });
    }

    const [visitCount, lastSession] = await Promise.all([
      prisma.diningSession.count({
        where: {
          tenantId: req.tenantId,
          customerId: customer.id,
        },
      }),
      prisma.diningSession.findFirst({
        where: {
          tenantId: req.tenantId,
          customerId: customer.id,
        },
        orderBy: { openedAt: 'desc' },
        select: {
          openedAt: true,
          source: true,
          table: {
            select: { name: true },
          },
        },
      }),
    ]);

    res.json({
      customer: {
        ...customer,
        visitCount,
        lastSessionAt: lastSession?.openedAt || null,
        lastTableName: lastSession?.table?.name || null,
        lastSource: lastSession?.source || null,
      },
    });
  } catch (error) {
    console.error('lookupAssistedCustomer error:', error);
    res.status(500).json({ error: 'Failed to lookup customer' });
  }
};

export const createAssistedOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id || !req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const customerName = String(req.body?.customerName || '').trim();
    const customerPhone = normalizePhone(req.body?.customerPhone);
    const orderType = String(req.body?.orderType || 'TAKEAWAY').toUpperCase();
    const fulfillmentMode = String(req.body?.fulfillmentMode || 'SEND_TO_KITCHEN').toUpperCase();
    const paymentMethod = String(req.body?.paymentMethod || '').trim().toLowerCase();
    const note = String(req.body?.note || '').trim();
    const seat = String(req.body?.seat || '').trim();
    const guestCount = Math.max(1, Math.min(24, Number(req.body?.guestCount) || 1));
    const requestedTableId = typeof req.body?.tableId === 'string' ? req.body.tableId.trim() : '';
    const markPaid = Boolean(req.body?.markPaid);

    if (!ASSISTED_FULFILLMENT_MODES.has(fulfillmentMode)) {
      return res.status(400).json({ error: 'Unsupported assisted ordering mode.' });
    }

    if (!['DINE_IN', 'TAKEAWAY', 'ROAMING'].includes(orderType)) {
      return res.status(400).json({ error: 'Unsupported order type.' });
    }

    if (paymentMethod && !ASSISTED_PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method.' });
    }

    if (orderType === 'DINE_IN' && !requestedTableId) {
      return res.status(400).json({ error: 'Select a table for dine-in assisted orders.' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        slug: true,
        businessName: true,
        taxRate: true,
        address: true,
        gstin: true,
        fssai: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const table = requestedTableId
      ? await prisma.table.findFirst({
          where: { id: requestedTableId, tenantId: tenant.id },
          select: { id: true, name: true, capacity: true },
        })
      : null;

    if (requestedTableId && !table) {
      return res.status(404).json({ error: 'Selected table was not found for this restaurant.' });
    }

    if (table && guestCount > Number(table.capacity || 0)) {
      return res.status(400).json({ error: 'Guest count exceeds table capacity.' });
    }

    const activeTableSession = table
      ? await prisma.diningSession.findFirst({
          where: {
            tenantId: tenant.id,
            tableId: table.id,
            sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
          },
          select: { id: true },
        })
      : null;

    if (activeTableSession) {
      return res.status(409).json({ error: 'This table already has an active session. Choose another table or finish the open session first.' });
    }

    const staffName = await resolveStaffName(prisma, req.user!.id);
    const { subtotal, orderItems } = await buildServerPricedOrderPayload(prisma, tenant.id, req.body?.items);

    const taxAmount = subtotal * (Number(tenant.taxRate || 0) / 100);
    const totalAmount = subtotal + taxAmount;

    const result = await prisma.$transaction(async (tx) => {
      const normalizedPhone =
        customerPhone.length >= 10
          ? customerPhone
          : `guest_assisted_${tenant.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let customer = await tx.customer.findUnique({
        where: { phone: normalizedPhone },
        select: { id: true, isActive: true, name: true, phone: true },
      });

      if (customer && !customer.isActive) {
        throw new Error('CUSTOMER_DEACTIVATED');
      }

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            phone: normalizedPhone,
            name: customerName || null,
          },
          select: { id: true, isActive: true, name: true, phone: true },
        });
      } else {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            lastSeenAt: new Date(),
            ...(customerName ? { name: customerName } : {}),
          },
          select: { id: true, isActive: true, name: true, phone: true },
        });
      }

      const orderNumber = await generateOrderNumberForTenant(tenant.id, orderType);
      const isDirectBill = fulfillmentMode === 'DIRECT_BILL';
      const shouldSettleImmediately = isDirectBill && (markPaid || Boolean(paymentMethod));
      const sessionStatus = isDirectBill
        ? shouldSettleImmediately
          ? 'CLOSED'
          : 'AWAITING_BILL'
        : 'ACTIVE';

      const session = await tx.diningSession.create({
        data: {
          tenantId: tenant.id,
          tableId: table?.id || null,
          customerId: customer.id,
          partySize: guestCount,
          sessionStatus: sessionStatus as any,
          source: isDirectBill ? 'staff_assisted_direct_bill' : 'staff_assisted',
          isBillGenerated: isDirectBill,
          billGeneratedAt: isDirectBill ? new Date() : null,
          closedAt: shouldSettleImmediately ? new Date() : null,
          attendedByUserId: req.user!.id,
          attendedByName: staffName,
        },
        select: {
          id: true,
          tenantId: true,
          tableId: true,
          sessionStatus: true,
          closedAt: true,
        },
      });

      const order = await tx.order.create({
        data: {
          tenantId: tenant.id,
          tableId: table?.id || null,
          diningSessionId: session.id,
          orderNumber,
          orderType: orderType as any,
          status: isDirectBill ? ('RECEIVED' as any) : ('NEW' as any),
          placedBy: 'vendor',
          subtotal,
          taxAmount,
          discountAmount: 0,
          totalAmount,
          customerName: customerName || customer.name || null,
          customerPhone: customer.phone,
          specialInstructions: [note, seat ? `Seat ${seat}` : null].filter(Boolean).join(' | ') || null,
          completedAt: isDirectBill ? new Date() : null,
          items: {
            create: orderItems,
          },
        },
        select: orderSelect,
      });

      const bill = isDirectBill
        ? await tx.bill.create({
            data: {
              tenantId: tenant.id,
              sessionId: session.id,
              subtotal,
              taxAmount,
              discountAmount: 0,
              totalAmount,
              invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
              paymentStatus: shouldSettleImmediately ? 'PAID' : 'UNPAID',
              paymentMethod: shouldSettleImmediately ? paymentMethod || 'cash' : null,
              paidAt: shouldSettleImmediately ? new Date() : null,
              businessName: tenant.businessName,
              businessAddress: tenant.address,
              gstin: tenant.gstin,
              fssai: tenant.fssai,
            } as any,
            select: {
              id: true,
              invoiceNumber: true,
              paymentStatus: true,
              paymentMethod: true,
              totalAmount: true,
            },
          })
        : null;

      if (table?.id) {
        await tx.table.update({
          where: { id: table.id },
          data: {
            status: isDirectBill
              ? shouldSettleImmediately
                ? 'AVAILABLE'
                : 'AWAITING_BILL'
              : ('ORDERING_OPEN' as any),
            currentOrderId: isDirectBill ? null : order.id,
            currentSessionId: shouldSettleImmediately ? null : session.id,
          },
        });
      }

      return {
        order,
        session,
        bill,
      };
    });

    const tenantRoom = getTenantRoom(tenant.id);
    const sessionRoom = getSessionRoom(tenant.id, result.session.id);
    const billPath = `/order/${tenant.slug}/session/${result.session.id}/bill`;
    const isDirectBill = fulfillmentMode === 'DIRECT_BILL';
    const settledImmediately = Boolean(result.bill && result.bill.paymentStatus === 'PAID');

    if (!isDirectBill) {
      getIO().to(tenantRoom).emit('order:new', result.order);
      getIO().to(sessionRoom).emit('order:new', result.order);
      getIO().to(tenantRoom).emit('session:update', {
        sessionId: result.session.id,
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      });
      getIO().to(sessionRoom).emit('session:update', {
        sessionId: result.session.id,
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      });
      if (result.order.tableId) {
        getIO().to(tenantRoom).emit('table:status_change', {
          tableId: result.order.tableId,
          status: 'ORDERING_OPEN',
          orderNumber: result.order.orderNumber,
        });
      }
    } else if (settledImmediately) {
      getIO().to(tenantRoom).emit('session:completed', {
        sessionId: result.session.id,
        paymentMethod: result.bill?.paymentMethod || 'cash',
        closedAt: result.session.closedAt || new Date().toISOString(),
      });
      getIO().to(sessionRoom).emit('session:completed', {
        sessionId: result.session.id,
        paymentMethod: result.bill?.paymentMethod || 'cash',
        closedAt: result.session.closedAt || new Date().toISOString(),
      });
      getIO().to(tenantRoom).emit('orders:bulk_status', {
        sessionId: result.session.id,
        status: 'RECEIVED',
        updatedAt: new Date().toISOString(),
      });
      if (result.order.tableId) {
        getIO().to(tenantRoom).emit('table:status_change', {
          tableId: result.order.tableId,
          status: 'AVAILABLE',
        });
      }
    } else {
      getIO().to(tenantRoom).emit('session:finished', {
        sessionId: result.session.id,
        tableName: table?.name,
        totalAmount: result.bill?.totalAmount,
      });
      getIO().to(sessionRoom).emit('session:finished', {
        sessionId: result.session.id,
        tableName: table?.name,
        totalAmount: result.bill?.totalAmount,
      });
      getIO().to(tenantRoom).emit('session:update', {
        sessionId: result.session.id,
        status: 'AWAITING_BILL',
        updatedAt: new Date().toISOString(),
      });
      getIO().to(sessionRoom).emit('session:update', {
        sessionId: result.session.id,
        status: 'AWAITING_BILL',
        updatedAt: new Date().toISOString(),
      });
      if (result.order.tableId) {
        getIO().to(tenantRoom).emit('table:status_change', {
          tableId: result.order.tableId,
          status: 'AWAITING_BILL',
        });
      }
    }

    await invalidateDashboardOrderCaches(tenant.id);

    res.status(201).json({
      source: isDirectBill ? 'STAFF_ASSISTED_DIRECT_BILL' : 'STAFF_ASSISTED',
      tenantSlug: tenant.slug,
      sessionId: result.session.id,
      orderId: result.order.id,
      billId: result.bill?.id || null,
      invoiceNumber: result.bill?.invoiceNumber || null,
      sessionStatus: result.session.sessionStatus,
      paymentStatus: result.bill?.paymentStatus || null,
      billPath,
      createdByStaffUserId: req.user.id,
      order: result.order,
      bill: result.bill,
    });
  } catch (error: any) {
    console.error('createAssistedOrder error:', error);

    const message = error instanceof Error ? error.message : 'Failed to create assisted order';
    if (message === 'ORDER_ITEMS_REQUIRED' || message === 'ORDER_ITEMS_INVALID') {
      return res.status(400).json({ error: 'Select at least one valid menu item before creating the order.' });
    }
    if (message === 'CUSTOMER_DEACTIVATED') {
      return res.status(403).json({ error: 'This customer account has been deactivated and cannot be reused.' });
    }
    if (message.startsWith('MENU_ITEM_NOT_FOUND')) {
      return res.status(409).json({ error: 'One or more items are no longer available. Refresh the menu and try again.' });
    }
    if (message.startsWith('MODIFIER_REQUIRED')) {
      return res.status(400).json({ error: `Required choices are missing for ${message.split(':')[1] || 'this item'}.` });
    }
    if (message.startsWith('MODIFIER_LIMIT')) {
      return res.status(400).json({ error: `Too many choices were selected for ${message.split(':')[1] || 'this item'}.` });
    }
    if (message.startsWith('MODIFIER_NOT_FOUND')) {
      return res.status(409).json({ error: 'One or more modifiers are no longer available. Refresh the menu and try again.' });
    }

    res.status(500).json({ error: 'Failed to create assisted order' });
  }
};
