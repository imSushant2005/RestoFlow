"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssistedOrder = exports.lookupAssistedCustomer = exports.updateOrderStatus = exports.getOrder = exports.getOrderHistory = exports.getOrders = void 0;
const crypto_1 = require("crypto");
const prisma_1 = require("../db/prisma");
const socket_1 = require("../socket");
const cache_service_1 = require("../services/cache.service");
const order_service_1 = require("../services/order.service");
const order_number_service_1 = require("../services/order-number.service");
const order_payload_service_1 = require("../services/order-payload.service");
const cache_keys_1 = require("../utils/cache-keys");
const VALID_ORDER_STATUSES = new Set([
    'NEW',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'SERVED',
    'RECEIVED',
    'CANCELLED',
]);
const ACTIVE_BOARD_STATUSES = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];
const ASSISTED_FULFILLMENT_MODES = new Set(['SEND_TO_KITCHEN', 'DIRECT_BILL']);
const ASSISTED_PAYMENT_METHODS = new Set(['cash', 'upi', 'card', 'online']);
const LIVE_ORDERS_CACHE_TTL_SECONDS = 3;
const ORDER_HISTORY_CACHE_TTL_SECONDS = 15;
const ROLE_ALLOWED_STATUS_UPDATES = {
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
};
const orderItemSelect = {
    ...leanOrderItemSelect,
    menuItem: {
        select: {
            id: true,
            name: true,
            price: true,
        },
    },
};
const LIVE_ORDERS_SELECT = {
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
};
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
};
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
};
function getTodayStart() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
}
function buildWaiterPickupPayload(order) {
    const tableName = order.table?.name || null;
    const zoneName = order.table?.zone?.name || null;
    const orderType = String(order.orderType || '').toUpperCase();
    const destinationLabel = orderType === 'TAKEAWAY'
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
function normalizePhone(value) {
    return String(value || '').replace(/\s+/g, '').trim();
}
async function resolveStaffName(db, userId) {
    if (!userId)
        return 'Staff';
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });
    return user?.name?.trim() || 'Staff';
}
// generateOrderNumberForTenant removed — replaced by generateOrderNumber() from order-number.service.
// The old COUNT+1 approach had a TOCTOU race: two concurrent requests both read the same count
// and generated duplicate order numbers. The new approach is synchronous and collision-resistant.
function getLiveOrdersCacheKey(tenantId) {
    return cache_keys_1.cacheKeys.dashboardLiveOrders(tenantId);
}
function getOrderHistoryCacheKey(tenantId, page, limit, statusKey) {
    return cache_keys_1.cacheKeys.dashboardOrderHistory(tenantId, page, limit, statusKey);
}
function parseHistoryStatuses(statusQuery) {
    if (!statusQuery) {
        return ['RECEIVED', 'CANCELLED'];
    }
    const requestedStatuses = statusQuery
        .split(',')
        .map((status) => status.trim().toUpperCase())
        .filter((status) => VALID_ORDER_STATUSES.has(status));
    const uniqueStatuses = Array.from(new Set(requestedStatuses));
    return uniqueStatuses.length > 0 ? uniqueStatuses : ['RECEIVED', 'CANCELLED'];
}
function isActiveSessionConflictError(error) {
    if (!error || typeof error !== 'object')
        return false;
    const maybeError = error;
    return (maybeError.code === 'P2002' ||
        String(maybeError.message || '').includes('DiningSession_active_table_session_uidx'));
}
async function invalidateOrderMutationCaches(tenantId, sessionId, orderId) {
    await Promise.all([
        (0, cache_service_1.deleteCache)(getLiveOrdersCacheKey(tenantId)),
        (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.dashboardOrderHistoryPattern(tenantId)),
        sessionId ? (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.publicSession(tenantId, sessionId)) : Promise.resolve(),
        sessionId ? (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.sessionOrders(tenantId, sessionId)) : Promise.resolve(),
        orderId ? (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.publicOrderInfo(tenantId, orderId)) : Promise.resolve(),
    ]);
}
const getOrders = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const orders = await (0, cache_service_1.withCache)(getLiveOrdersCacheKey(tenantId), () => (0, prisma_1.withPrismaRetry)(() => prisma_1.prisma.order.findMany({
            where: {
                tenantId,
                status: { in: ACTIVE_BOARD_STATUSES },
            },
            select: LIVE_ORDERS_SELECT,
            orderBy: { createdAt: 'asc' },
        }), `dashboard-live-orders:${tenantId}`), LIVE_ORDERS_CACHE_TTL_SECONDS);
        res.json(orders);
    }
    catch (error) {
        console.error('getOrders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};
exports.getOrders = getOrders;
const getOrderHistory = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const statusQuery = req.query.status?.toUpperCase();
        const includeCount = String(req.query.includeCount || '').toLowerCase() === 'true';
        const skip = (page - 1) * limit;
        const historyStatuses = parseHistoryStatuses(statusQuery);
        const statusFilter = { in: historyStatuses };
        const historyCacheKey = getOrderHistoryCacheKey(req.tenantId, page, limit, `${statusQuery || 'terminal'}_${includeCount ? 'count' : 'nocount'}`);
        const whereClause = {
            tenantId: req.tenantId,
            status: statusFilter,
            createdAt: {
                gte: getTodayStart(),
            },
        };
        const { orders, total } = await (0, cache_service_1.withCache)(historyCacheKey, async () => {
            const orders = await (0, prisma_1.withPrismaRetry)(() => prisma_1.prisma.order.findMany({
                where: whereClause,
                select: HISTORY_ORDERS_SELECT,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }), `dashboard-order-history:${req.tenantId}:orders`);
            const total = includeCount
                ? await (0, prisma_1.withPrismaRetry)(() => prisma_1.prisma.order.count({
                    where: whereClause,
                }), `dashboard-order-history:${req.tenantId}:count`)
                : null;
            return { orders, total };
        }, ORDER_HISTORY_CACHE_TTL_SECONDS);
        res.json({
            data: orders,
            pagination: {
                total,
                page,
                limit,
                totalPages: typeof total === 'number' ? Math.ceil(total / limit) : null,
            },
        });
    }
    catch (error) {
        console.error('getOrderHistory error:', error);
        res.status(500).json({ error: 'Failed to fetch order history' });
    }
};
exports.getOrderHistory = getOrderHistory;
const getOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const order = await (0, prisma_1.withPrismaRetry)(() => prisma_1.prisma.order.findUnique({
            where: { id, tenantId },
            select: orderSelect,
        }), `dashboard-get-order:${id}`);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    }
    catch (error) {
        console.error('getOrder error:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
};
exports.getOrder = getOrder;
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
        const statusPatch = {};
        if (normalizedStatus === 'RECEIVED')
            statusPatch.completedAt = transitionAt;
        if (normalizedStatus === 'CANCELLED') {
            statusPatch.cancelledAt = transitionAt;
            statusPatch.cancellationReason =
                typeof cancelReason === 'string' && cancelReason.trim().length > 0 ? cancelReason.trim() : null;
        }
        if (normalizedStatus === 'ACCEPTED')
            statusPatch.acceptedAt = transitionAt;
        if (normalizedStatus === 'PREPARING')
            statusPatch.preparingAt = transitionAt;
        if (normalizedStatus === 'READY')
            statusPatch.readyAt = transitionAt;
        if (normalizedStatus === 'SERVED')
            statusPatch.servedAt = transitionAt;
        const attendingStaffName = normalizedStatus === 'SERVED' && existingOrder.diningSessionId && req.user?.id
            ? (await prisma_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: { name: true },
            }))?.name?.trim() || 'Service Staff'
            : null;
        // Use the OCC state machine transition service
        let order;
        try {
            const expectedVersion = typeof req.body.version === 'number' ? req.body.version : existingOrder.version;
            const metadata = {
                sourceIp: req.ip,
                userAgent: req.get('user-agent'),
            };
            order = await (0, order_service_1.transitionOrderStatus)({
                orderId: existingOrder.id,
                tenantId: req.tenantId,
                expectedVersion,
                newStatus: normalizedStatus,
                actorId: req.user.id,
                actorType: 'USER',
                deviceId: req.headers['x-device-id'],
                reasonCode: cancelReason,
                metadata,
                statusPatch,
            });
            // Secondary update for DiningSession if SERVED
            if (normalizedStatus === 'SERVED' && existingOrder.diningSessionId && req.user?.id) {
                await prisma_1.prisma.diningSession.update({
                    where: { id: existingOrder.diningSessionId },
                    data: {
                        attendedByUserId: req.user.id,
                        attendedByName: attendingStaffName,
                    },
                });
            }
        }
        catch (err) {
            if (err instanceof order_service_1.ConflictError || err.message === 'OCC_COLLISION') {
                const truth = await prisma_1.prisma.order.findFirst({
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
        const tenantRoom = (0, socket_1.getTenantRoom)(req.tenantId);
        (0, socket_1.getIO)().to(tenantRoom).emit('order:update', order);
        if (order.diningSessionId) {
            (0, socket_1.getIO)().to((0, socket_1.getSessionRoom)(req.tenantId, order.diningSessionId)).emit('order:update', order);
        }
        if (normalizedStatus === 'READY') {
            (0, socket_1.getIO)().to((0, socket_1.getRoleRoom)(req.tenantId, 'WAITER')).emit('waiter:pickup_ready', buildWaiterPickupPayload(order));
        }
        // Respond immediately — cache invalidation runs async after response is flushed
        res.json(order);
        setImmediate(() => {
            invalidateOrderMutationCaches(req.tenantId, existingOrder.diningSessionId, existingOrder.id).catch((err) => console.error('[CACHE_INVALIDATION_ERROR]', err));
        });
    }
    catch (error) {
        console.error('updateOrderStatus error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
const lookupAssistedCustomer = async (req, res) => {
    try {
        const phone = normalizePhone(req.query.phone);
        if (phone.length < 10) {
            return res.status(400).json({ error: 'A valid mobile number is required for lookup.' });
        }
        const customer = await prisma_1.prisma.customer.findUnique({
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
            prisma_1.prisma.diningSession.count({
                where: {
                    tenantId: req.tenantId,
                    customerId: customer.id,
                },
            }),
            prisma_1.prisma.diningSession.findFirst({
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
    }
    catch (error) {
        console.error('lookupAssistedCustomer error:', error);
        res.status(500).json({ error: 'Failed to lookup customer' });
    }
};
exports.lookupAssistedCustomer = lookupAssistedCustomer;
const createAssistedOrder = async (req, res) => {
    try {
        if (!req.user?.id || !req.tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const customerName = String(req.body?.customerName || '').trim();
        const customerPhone = normalizePhone(req.body?.customerPhone);
        const orderType = String(req.body?.orderType || 'TAKEAWAY').toUpperCase();
        const fulfillmentMode = String(req.body?.fulfillmentMode || 'SEND_TO_KITCHEN').toUpperCase();
        const isDirectBill = fulfillmentMode === 'DIRECT_BILL';
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
        const tenant = await prisma_1.prisma.tenant.findUnique({
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
            ? await prisma_1.prisma.table.findFirst({
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
            ? await prisma_1.prisma.diningSession.findFirst({
                where: {
                    tenantId: tenant.id,
                    tableId: table.id,
                    sessionStatus: { notIn: ['CLOSED', 'CANCELLED'] },
                },
                select: { id: true },
            })
            : null;
        if (activeTableSession) {
            return res.status(409).json({ error: 'This table already has an active session. Choose another table or finish the open session first.' });
        }
        const staffName = await resolveStaffName(prisma_1.prisma, req.user.id);
        const { subtotal, orderItems } = await (0, order_payload_service_1.buildServerPricedOrderPayload)(prisma_1.prisma, tenant.id, req.body?.items);
        const taxAmount = subtotal * (Number(tenant.taxRate || 0) / 100);
        const totalAmount = subtotal + taxAmount;
        try {
            const result = await prisma_1.prisma.$transaction(async (tx) => {
                const normalizedPhone = customerPhone.length >= 10
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
                }
                else {
                    customer = await tx.customer.update({
                        where: { id: customer.id },
                        data: {
                            lastSeenAt: new Date(),
                            ...(customerName ? { name: customerName } : {}),
                        },
                        select: { id: true, isActive: true, name: true, phone: true },
                    });
                }
                const orderNumber = (0, order_number_service_1.generateOrderNumber)(orderType);
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
                        sessionStatus: sessionStatus,
                        source: isDirectBill ? 'staff_assisted_direct_bill' : 'staff_assisted',
                        isBillGenerated: isDirectBill,
                        billGeneratedAt: isDirectBill ? new Date() : null,
                        closedAt: shouldSettleImmediately ? new Date() : null,
                        attendedByUserId: req.user.id,
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
                        orderType: orderType,
                        status: isDirectBill ? 'RECEIVED' : 'NEW',
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
                            invoiceNumber: `INV-${(0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
                            paymentStatus: shouldSettleImmediately ? 'PAID' : 'UNPAID',
                            paymentMethod: shouldSettleImmediately ? paymentMethod || 'cash' : null,
                            paidAt: shouldSettleImmediately ? new Date() : null,
                            businessName: tenant.businessName,
                            businessAddress: tenant.address,
                            gstin: tenant.gstin,
                            fssai: tenant.fssai,
                        },
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
                                : 'ORDERING_OPEN',
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
            const billPath = `/order/${tenant.slug}/session/${result.session.id}/bill`;
            const settledImmediately = Boolean(result.bill && result.bill.paymentStatus === 'PAID');
            res.status(201).json({
                source: fulfillmentMode === 'DIRECT_BILL' ? 'STAFF_ASSISTED_DIRECT_BILL' : 'STAFF_ASSISTED',
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
            setImmediate(async () => {
                try {
                    const io = (0, socket_1.getIO)();
                    const tenantRoom = (0, socket_1.getTenantRoom)(tenant.id);
                    const sessionRoom = (0, socket_1.getSessionRoom)(tenant.id, result.session.id);
                    if (!isDirectBill) {
                        io.to(tenantRoom).emit('order:new', result.order);
                        io.to(sessionRoom).emit('order:new', result.order);
                        io.to(tenantRoom).emit('session:update', {
                            sessionId: result.session.id,
                            status: 'ACTIVE',
                            updatedAt: new Date().toISOString(),
                        });
                        io.to(sessionRoom).emit('session:update', {
                            sessionId: result.session.id,
                            status: 'ACTIVE',
                            updatedAt: new Date().toISOString(),
                        });
                        if (result.order.tableId) {
                            io.to(tenantRoom).emit('table:status_change', {
                                tableId: result.order.tableId,
                                status: 'ORDERING_OPEN',
                                orderNumber: result.order.orderNumber,
                            });
                        }
                    }
                    else if (settledImmediately) {
                        io.to(tenantRoom).emit('session:completed', {
                            sessionId: result.session.id,
                            paymentMethod: result.bill?.paymentMethod || 'cash',
                            closedAt: result.session.closedAt || new Date(),
                        });
                        io.to(sessionRoom).emit('session:completed', {
                            sessionId: result.session.id,
                            paymentMethod: result.bill?.paymentMethod || 'cash',
                            closedAt: result.session.closedAt || new Date(),
                        });
                        io.to(tenantRoom).emit('orders:bulk_status', {
                            sessionId: result.session.id,
                            status: 'RECEIVED',
                            updatedAt: new Date().toISOString(),
                        });
                        if (result.order.tableId) {
                            io.to(tenantRoom).emit('table:status_change', {
                                tableId: result.order.tableId,
                                status: 'AVAILABLE',
                            });
                        }
                    }
                    else {
                        io.to(tenantRoom).emit('session:finished', {
                            sessionId: result.session.id,
                            tableName: table?.name,
                            totalAmount: result.bill?.totalAmount,
                        });
                        io.to(sessionRoom).emit('session:finished', {
                            sessionId: result.session.id,
                            tableName: table?.name,
                            totalAmount: result.bill?.totalAmount,
                        });
                        io.to(tenantRoom).emit('session:update', {
                            sessionId: result.session.id,
                            status: 'AWAITING_BILL',
                            updatedAt: new Date().toISOString(),
                        });
                        io.to(sessionRoom).emit('session:update', {
                            sessionId: result.session.id,
                            status: 'AWAITING_BILL',
                            updatedAt: new Date().toISOString(),
                        });
                        if (result.order.tableId) {
                            io.to(tenantRoom).emit('table:status_change', {
                                tableId: result.order.tableId,
                                status: 'AWAITING_BILL',
                            });
                        }
                    }
                    await invalidateOrderMutationCaches(tenant.id, result.session.id, result.order.id);
                }
                catch (err) {
                    console.error('[ASSISTED_ORDER_POST_CREATE_ERROR]', err);
                }
            });
        }
        catch (error) {
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
            const conflictTableId = typeof req.body?.tableId === 'string' ? req.body.tableId.trim() : '';
            if (conflictTableId && isActiveSessionConflictError(error)) {
                const activeSession = await prisma_1.prisma.diningSession.findFirst({
                    where: {
                        tenantId: req.tenantId,
                        tableId: conflictTableId,
                        sessionStatus: { notIn: ['CLOSED', 'CANCELLED'] },
                    },
                    select: { id: true },
                });
                if (activeSession) {
                    return res.status(409).json({
                        error: 'This table already has an active session. Choose another table or finish the open session first.',
                        existingSessionId: activeSession.id,
                    });
                }
            }
            res.status(500).json({ error: 'Failed to create assisted order' });
        }
    }
    catch (error) {
        console.error('createAssistedOrder outer error:', error);
        res.status(500).json({ error: 'Failed to create assisted order' });
    }
};
exports.createAssistedOrder = createAssistedOrder;
//# sourceMappingURL=order.controller.js.map