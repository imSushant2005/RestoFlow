import { Request, Response } from 'express';
import { UserRole } from '@dineflow/prisma';
import { prisma } from '../db/prisma';
import { getIO, getSessionRoom, getTenantRoom } from '../socket';
import { sendWhatsAppNotification } from '../services/notification.service';

const VALID_ORDER_STATUSES = new Set([
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'SERVED',
  'RECEIVED',
  'CANCELLED',
]);

const ROLE_ALLOWED_STATUS_UPDATES: Record<UserRole, Set<string>> = {
  OWNER: new Set(VALID_ORDER_STATUSES),
  MANAGER: new Set(VALID_ORDER_STATUSES),
  KITCHEN: new Set(['ACCEPTED', 'PREPARING', 'READY']),
  CASHIER: new Set(['SERVED', 'RECEIVED', 'CANCELLED']),
  WAITER: new Set(['SERVED']),
};

const orderItemSelect = {
  id: true,
  name: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  specialNote: true,
  selectedModifiers: true,
  menuItem: {
    select: {
      id: true,
      name: true,
      price: true,
    },
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

export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        status: { notIn: ['RECEIVED' as any, 'CANCELLED' as any] },
      },
      select: orderSelect,
      orderBy: { createdAt: 'asc' },
    });
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

    const whereClause = {
      tenantId: req.tenantId,
      status: statusFilter,
      createdAt: {
        gte: getTodayStart(),
      },
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        select: orderSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({
        where: whereClause,
      }),
    ]);

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

    const dataToUpdate: any = { status: normalizedStatus };
    if (cancelReason !== undefined) dataToUpdate.cancellationReason = cancelReason;
    if (normalizedStatus === 'RECEIVED') dataToUpdate.completedAt = new Date();
    if (normalizedStatus === 'CANCELLED') dataToUpdate.cancelledAt = new Date();
    if (normalizedStatus === 'ACCEPTED') dataToUpdate.acceptedAt = new Date();
    if (normalizedStatus === 'PREPARING') dataToUpdate.preparingAt = new Date();
    if (normalizedStatus === 'READY') dataToUpdate.readyAt = new Date();
    if (normalizedStatus === 'SERVED') dataToUpdate.servedAt = new Date();

    const attendingStaffName =
      normalizedStatus === 'SERVED' && existingOrder.diningSessionId && req.user?.id
        ? (
            await prisma.user.findUnique({
              where: { id: req.user.id },
              select: { name: true },
            })
          )?.name?.trim() || 'Service Staff'
        : null;

    const order = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: existingOrder.id },
        data: dataToUpdate,
        select: orderSelect,
      });

      if (normalizedStatus === 'SERVED' && existingOrder.diningSessionId && req.user?.id) {
        await tx.diningSession.update({
          where: { id: existingOrder.diningSessionId },
          data: {
            attendedByUserId: req.user.id,
            attendedByName: attendingStaffName,
          },
        });
      }

      return updatedOrder;
    });

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
      getIO().to(tenantRoom).emit('waiter:pickup_ready', buildWaiterPickupPayload(order));
    }

    if (order.customerPhone) {
      try {
        if (normalizedStatus === 'ACCEPTED') {
          await sendWhatsAppNotification(
            order.customerPhone,
            `Hi ${order.customerName || 'Customer'}! Your order ${order.orderNumber} has been accepted and is being prepared.`,
          );
        } else if (normalizedStatus === 'READY') {
          await sendWhatsAppNotification(
            order.customerPhone,
            `Great news! Your order ${order.orderNumber} is ready. Please collect it or our staff will serve it shortly.`,
          );
        }
      } catch (notifError) {
        console.error('[NOTIF_ERROR] WhatsApp delivery failed:', notifError);
      }
    }

    res.json(order);
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};
