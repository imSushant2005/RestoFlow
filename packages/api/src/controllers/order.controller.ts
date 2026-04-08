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
  KITCHEN: new Set(['ACCEPTED', 'PREPARING', 'READY', 'SERVED']),
  CASHIER: new Set(['SERVED', 'RECEIVED', 'CANCELLED']),
  WAITER: new Set(['SERVED']),
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        status: { notIn: ['RECEIVED' as any, 'CANCELLED' as any] },
      },
      include: {
        table: true,
        diningSession: { include: { customer: true } },
        items: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(orders);
  } catch (error) {
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
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          table: true,
          items: { include: { menuItem: true } },
        },
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

    const dataToUpdate: any = { status: normalizedStatus };
    if (cancelReason !== undefined) dataToUpdate.cancellationReason = cancelReason;
    if (normalizedStatus === 'RECEIVED') dataToUpdate.completedAt = new Date();
    if (normalizedStatus === 'CANCELLED') dataToUpdate.cancelledAt = new Date();
    if (normalizedStatus === 'ACCEPTED') dataToUpdate.acceptedAt = new Date();
    if (normalizedStatus === 'PREPARING') dataToUpdate.preparingAt = new Date();
    if (normalizedStatus === 'READY') dataToUpdate.readyAt = new Date();

    const order = await prisma.order.update({
      where: { id: existingOrder.id },
      data: dataToUpdate,
      include: {
        table: true,
        diningSession: {
          include: {
            customer: true,
          },
        },
        items: {
          include: {
            menuItem: true,
          },
        },
      },
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

    // Table status is now managed exclusively by DiningSession creation and closure to support multi-order sessions.
    // Individual order completion should NOT trigger a table reset to CLEANING.

    if (order.customerPhone) {
      try {
        if (normalizedStatus === 'ACCEPTED') {
          await sendWhatsAppNotification(
            order.customerPhone,
            `Hi ${order.customerName || 'Customer'}! Your order ${order.orderNumber} has been accepted and is being prepared.`
          );
        } else if (normalizedStatus === 'READY') {
          await sendWhatsAppNotification(
            order.customerPhone,
            `Great news! Your order ${order.orderNumber} is ready. Please collect it or our staff will serve it shortly.`
          );
        }
      } catch (notifError) {
        console.error('[NOTIF_ERROR] WhatsApp delivery failed:', notifError);
        // We continue as the order update itself was successful in the DB.
      }
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

