"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrderHistory = exports.getOrders = void 0;
const prisma_1 = require("../db/prisma");
const socket_1 = require("../socket");
const notification_service_1 = require("../services/notification.service");
const VALID_ORDER_STATUSES = new Set([
    'NEW',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'SERVED',
    'RECEIVED',
    'CANCELLED',
]);
const ROLE_ALLOWED_STATUS_UPDATES = {
    OWNER: new Set(VALID_ORDER_STATUSES),
    MANAGER: new Set(VALID_ORDER_STATUSES),
    KITCHEN: new Set(['ACCEPTED', 'PREPARING', 'READY', 'SERVED']),
    CASHIER: new Set(['SERVED', 'RECEIVED', 'CANCELLED']),
    WAITER: new Set(['SERVED']),
};
const getOrders = async (req, res) => {
    try {
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                tenantId: req.tenantId,
                status: { notIn: ['RECEIVED', 'CANCELLED'] },
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};
exports.getOrders = getOrders;
const getOrderHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const statusQuery = req.query.status?.toUpperCase();
        const skip = (page - 1) * limit;
        const statusFilter = statusQuery === 'RECEIVED' || statusQuery === 'CANCELLED'
            ? { in: [statusQuery] }
            : { in: ['RECEIVED', 'CANCELLED'] };
        const whereClause = {
            tenantId: req.tenantId,
            status: statusFilter,
        };
        const [orders, total] = await Promise.all([
            prisma_1.prisma.order.findMany({
                where: whereClause,
                include: {
                    table: true,
                    items: { include: { menuItem: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.order.count({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch order history' });
    }
};
exports.getOrderHistory = getOrderHistory;
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const normalizedStatus = typeof req.body?.status === 'string' ? req.body.status.toUpperCase() : '';
        const { cancelReason } = req.body;
        if (!VALID_ORDER_STATUSES.has(normalizedStatus)) {
            return res.status(400).json({ error: 'Invalid order status' });
        }
        const role = req.user?.role;
        if (!role) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const allowedStatuses = ROLE_ALLOWED_STATUS_UPDATES[role];
        if (!allowedStatuses || !allowedStatuses.has(normalizedStatus)) {
            return res.status(403).json({ error: `Role ${role} cannot set status to ${normalizedStatus}` });
        }
        const existingOrder = await prisma_1.prisma.order.findFirst({
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
        const dataToUpdate = { status: normalizedStatus };
        if (cancelReason !== undefined)
            dataToUpdate.cancellationReason = cancelReason;
        if (normalizedStatus === 'RECEIVED')
            dataToUpdate.completedAt = new Date();
        if (normalizedStatus === 'CANCELLED')
            dataToUpdate.cancelledAt = new Date();
        if (normalizedStatus === 'ACCEPTED')
            dataToUpdate.acceptedAt = new Date();
        if (normalizedStatus === 'PREPARING')
            dataToUpdate.preparingAt = new Date();
        if (normalizedStatus === 'READY')
            dataToUpdate.readyAt = new Date();
        const order = await prisma_1.prisma.order.update({
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
        const tenantRoom = (0, socket_1.getTenantRoom)(req.tenantId);
        (0, socket_1.getIO)().to(tenantRoom).emit('order:update', order);
        if (order.diningSessionId) {
            (0, socket_1.getIO)().to((0, socket_1.getSessionRoom)(req.tenantId, order.diningSessionId)).emit('order:update', order);
            (0, socket_1.getIO)().to(tenantRoom).emit('session:update', {
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
                    await (0, notification_service_1.sendWhatsAppNotification)(order.customerPhone, `Hi ${order.customerName || 'Customer'}! Your order ${order.orderNumber} has been accepted and is being prepared.`);
                }
                else if (normalizedStatus === 'READY') {
                    await (0, notification_service_1.sendWhatsAppNotification)(order.customerPhone, `Great news! Your order ${order.orderNumber} is ready. Please collect it or our staff will serve it shortly.`);
                }
            }
            catch (notifError) {
                console.error('[NOTIF_ERROR] WhatsApp delivery failed:', notifError);
                // We continue as the order update itself was successful in the DB.
            }
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
//# sourceMappingURL=order.controller.js.map