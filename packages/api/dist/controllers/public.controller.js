"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatusPublic = exports.acknowledgeWaiterCall = exports.waiterCall = exports.submitFeedback = exports.getSessionOrders = exports.getOrderInfo = exports.createOrder = exports.resolveCustomDomain = exports.getPublicMenu = void 0;
const prisma_1 = require("../db/prisma");
const session_lock_1 = require("../db/session-lock");
const socket_1 = require("../socket");
const cache_service_1 = require("../services/cache.service");
const order_service_1 = require("../services/order.service");
const order_number_service_1 = require("../services/order-number.service");
const order_payload_service_1 = require("../services/order-payload.service");
const cache_keys_1 = require("../utils/cache-keys");
const public_access_1 = require("../utils/public-access");
const WAITER_CALL_TYPES = new Set(['WAITER', 'BILL', 'WATER', 'EXTRA', 'HELP']);
const ORDERABLE_SESSION_STATUSES = ['OPEN', 'PARTIALLY_SENT', 'ACTIVE'];
const publicOrderSelect = {
    id: true,
    tenantId: true,
    tableId: true,
    diningSessionId: true,
    orderNumber: true,
    orderType: true,
    status: true,
    subtotal: true,
    taxAmount: true,
    discountAmount: true,
    totalAmount: true,
    customerName: true,
    customerPhone: true,
    createdAt: true,
    updatedAt: true,
    readyAt: true,
    servedAt: true,
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
            sessionStatus: true,
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
        select: {
            id: true,
            menuItemId: true,
            name: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            selectedModifiers: true,
            specialNote: true,
            menuItem: {
                select: {
                    id: true,
                    name: true,
                    price: true,
                },
            },
        },
    },
};
function readOptionalString(value) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function readOptionalNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function normalizeStarRating(value) {
    const parsed = readOptionalNumber(value);
    if (parsed === undefined)
        return undefined;
    return Math.round(parsed);
}
async function resolveTenantIdBySlug(tenantSlug) {
    return (0, cache_service_1.withCache)(cache_keys_1.cacheKeys.tenantIdBySlug(tenantSlug), async () => (0, prisma_1.withPrismaRetry)(async () => {
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: { id: true },
        });
        if (!tenant) {
            throw new Error('Restaurant not found');
        }
        return tenant.id;
    }, `resolve-tenant-id:${tenantSlug}`), 86400);
}
async function resolveTenantBySlug(tenantSlug) {
    return (0, cache_service_1.withCache)(cache_keys_1.cacheKeys.tenantMeta(tenantSlug), async () => (0, prisma_1.withPrismaRetry)(async () => {
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: { id: true, taxRate: true, plan: true },
        });
        if (!tenant) {
            throw new Error('Vendor not found');
        }
        return tenant;
    }, `resolve-tenant:${tenantSlug}`), 300);
}
async function invalidateOperationalCaches(tenantId, sessionId, orderId) {
    await Promise.all([
        (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.dashboardLiveOrders(tenantId)),
        (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.dashboardOrderHistoryPattern(tenantId)),
        sessionId ? (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.publicSession(tenantId, sessionId)) : Promise.resolve(),
        sessionId ? (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.sessionOrders(tenantId, sessionId)) : Promise.resolve(),
        orderId ? (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.publicOrderInfo(tenantId, orderId)) : Promise.resolve(),
    ]);
}
async function resolveWaiterTableName(tenantId, tableId) {
    if (!tableId)
        return 'Unknown Table';
    const table = await prisma_1.prisma.table.findFirst({
        where: {
            tenantId,
            OR: [
                { id: tableId },
                { name: { equals: tableId, mode: 'insensitive' } },
            ],
        },
        select: { name: true },
    });
    const tableName = table?.name || tableId;
    return tableName.toLowerCase().startsWith('table ') ? tableName : `Table ${tableName}`;
}
async function resolveTenantTableId(tenantId, tableInput) {
    const trimmed = tableInput.trim();
    if (!trimmed)
        return null;
    const tableById = await prisma_1.prisma.table.findFirst({
        where: { id: trimmed, tenantId },
        select: { id: true },
    });
    if (tableById)
        return tableById.id;
    const tableByName = await prisma_1.prisma.table.findFirst({
        where: {
            tenantId,
            name: { equals: trimmed, mode: 'insensitive' },
        },
        select: { id: true },
    });
    return tableByName?.id || null;
}
const getPublicMenu = async (req, res) => {
    try {
        const { tenantSlug } = req.params;
        const cacheKey = `public_menu_${tenantSlug}`;
        const publicData = await (0, cache_service_1.withCache)(cacheKey, async () => (0, prisma_1.withPrismaRetry)(async () => {
            const tenant = await prisma_1.prisma.tenant.findUnique({
                where: { slug: tenantSlug },
                select: {
                    id: true,
                    businessName: true,
                    businessType: true,
                    description: true,
                    slug: true,
                    logoUrl: true,
                    coverImageUrl: true,
                    primaryColor: true,
                    accentColor: true,
                    taxRate: true,
                    businessHours: true,
                    plan: true,
                },
            });
            if (!tenant)
                throw new Error('Vendor not found');
            const categories = await prisma_1.prisma.category.findMany({
                where: {
                    tenantId: tenant.id,
                    isVisible: true,
                },
                orderBy: { sortOrder: 'asc' },
                include: {
                    menuItems: {
                        where: {
                            tenantId: tenant.id,
                            isAvailable: true,
                        },
                        orderBy: { sortOrder: 'asc' },
                        include: {
                            modifierGroups: {
                                include: {
                                    modifiers: {
                                        where: { isAvailable: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            return {
                tenantId: tenant.id,
                name: tenant.businessName, // alias used by customer frontend
                businessName: tenant.businessName,
                businessType: tenant.businessType,
                description: tenant.description || '',
                slug: tenant.slug,
                logoUrl: tenant.logoUrl || null,
                coverImageUrl: tenant.coverImageUrl || null,
                categories,
                primaryColor: tenant.primaryColor,
                accentColor: tenant.accentColor,
                taxRate: tenant.taxRate,
                businessHours: tenant.businessHours,
                plan: tenant.plan,
            };
        }, `public-menu:${tenantSlug}`), 1800); // 30-minute cache
        res.json(publicData);
    }
    catch (error) {
        const status = error instanceof Error && error.message === 'Vendor not found' ? 404 : 500;
        res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to fetch menu' });
    }
};
exports.getPublicMenu = getPublicMenu;
const resolveCustomDomain = async (req, res) => {
    try {
        const domain = req.query.domain;
        if (!domain)
            return res.status(400).json({ error: 'Domain missing' });
        const cacheKey = cache_keys_1.cacheKeys.customDomainResolution(domain);
        const resolution = await (0, cache_service_1.withCache)(cacheKey, async () => {
            const tenant = await prisma_1.prisma.tenant.findFirst({
                where: { website: { contains: domain } },
                select: { slug: true }
            });
            if (!tenant)
                throw new Error('Domain not mapped');
            return { success: true, slug: tenant.slug };
        }, 86400); // 24-hour resolution cache
        res.json(resolution);
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : 'Resolver failed' });
    }
};
exports.resolveCustomDomain = resolveCustomDomain;
const createOrder = async (req, res) => {
    try {
        const { tenantSlug } = req.params;
        const { sessionId, sessionToken, items, tableId, customerName, customerPhone } = req.body;
        const incomingSessionToken = readOptionalString(sessionId || sessionToken || null);
        const requestedTableInput = readOptionalString(tableId);
        const requestIdempotencyKey = readOptionalString(req.header('x-idempotency-key')) ||
            readOptionalString(req.body?.idempotencyKey);
        const tenant = await resolveTenantBySlug(tenantSlug);
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order must include at least one item' });
        }
        if (requestIdempotencyKey) {
            const cachedResponse = await (0, cache_service_1.getCache)(cache_keys_1.cacheKeys.publicOrderIdempotency(tenant.id, requestIdempotencyKey));
            if (cachedResponse) {
                return res.status(200).json(cachedResponse);
            }
        }
        let safeTableId = null;
        if (requestedTableInput) {
            safeTableId = await resolveTenantTableId(tenant.id, requestedTableInput);
            if (!safeTableId) {
                return res.status(400).json({
                    error: 'Invalid table reference. Please scan the QR again and restart the table flow.',
                    code: 'INVALID_TABLE',
                });
            }
        }
        let resolvedSession = incomingSessionToken
            ? await prisma_1.prisma.diningSession.findFirst({
                where: {
                    id: incomingSessionToken,
                    tenantId: tenant.id,
                    sessionStatus: { in: ORDERABLE_SESSION_STATUSES },
                },
                select: {
                    id: true,
                    tableId: true,
                    customerId: true,
                    sessionStatus: true,
                },
            })
            : null;
        const staleSession = incomingSessionToken && !resolvedSession
            ? await prisma_1.prisma.diningSession.findFirst({
                where: {
                    id: incomingSessionToken,
                    tenantId: tenant.id,
                },
                select: {
                    id: true,
                    tableId: true,
                    sessionStatus: true,
                },
            })
            : null;
        if (!safeTableId && staleSession?.tableId) {
            safeTableId = staleSession.tableId;
        }
        const isDineInTableFlow = Boolean(safeTableId || staleSession?.tableId);
        if (resolvedSession) {
            (0, public_access_1.authorizeSessionAccess)(req, {
                tenantId: tenant.id,
                sessionId: resolvedSession.id,
                customerId: resolvedSession.customerId,
                tenantSlug,
            });
        }
        if (!resolvedSession && safeTableId) {
            const activeTableSession = await prisma_1.prisma.diningSession.findFirst({
                where: {
                    tenantId: tenant.id,
                    tableId: safeTableId,
                    sessionStatus: { in: ORDERABLE_SESSION_STATUSES },
                },
                orderBy: { openedAt: 'desc' },
                select: {
                    id: true,
                    tableId: true,
                    customerId: true,
                    sessionStatus: true,
                },
            });
            if (activeTableSession) {
                (0, public_access_1.authorizeSessionAccess)(req, {
                    tenantId: tenant.id,
                    sessionId: activeTableSession.id,
                    customerId: activeTableSession.customerId,
                    tenantSlug,
                });
                resolvedSession = activeTableSession;
            }
        }
        if (!resolvedSession && isDineInTableFlow) {
            return res.status(409).json({
                error: 'Active table session required before ordering. Please restart from QR login and party size.',
                code: 'SESSION_REQUIRED',
                tableId: safeTableId,
                previousSessionStatus: staleSession?.sessionStatus || null,
            });
        }
        const { subtotal, orderItems: orderItemsCreate } = await (0, order_payload_service_1.buildServerPricedOrderPayload)(prisma_1.prisma, tenant.id, items);
        const taxAmount = subtotal * (tenant.taxRate / 100);
        const totalAmount = subtotal + taxAmount;
        const orderType = safeTableId ? 'DINE_IN' : 'TAKEAWAY';
        const orderNumber = (0, order_number_service_1.generateOrderNumber)(orderType); // Collision-resistant — replaces COUNT+1 race
        let order;
        let lockedSession = resolvedSession;
        try {
            const txResult = await prisma_1.prisma.$transaction(async (tx) => {
                let currentSession = resolvedSession;
                if (currentSession) {
                    await (0, session_lock_1.lockSessionForMutation)(tx, currentSession.id);
                    currentSession = await tx.diningSession.findUnique({
                        where: { id: currentSession.id },
                        select: {
                            id: true,
                            tableId: true,
                            customerId: true,
                            sessionStatus: true,
                        },
                    });
                    if (!currentSession) {
                        throw new Error('SESSION_NOT_FOUND');
                    }
                    if (!ORDERABLE_SESSION_STATUSES.includes(currentSession.sessionStatus)) {
                        throw new Error('SESSION_NOT_ORDERABLE');
                    }
                }
                else {
                    const normalizedPhone = typeof customerPhone === 'string' && customerPhone.trim().length > 0
                        ? customerPhone.trim()
                        : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    let customer = await tx.customer.findUnique({
                        where: { phone: normalizedPhone },
                        select: { id: true, isActive: true },
                    });
                    if (!customer) {
                        customer = await tx.customer.create({
                            data: {
                                phone: normalizedPhone,
                                name: typeof customerName === 'string' && customerName.trim().length > 0 ? customerName.trim() : null,
                            },
                            select: { id: true, isActive: true },
                        });
                    }
                    if (!customer.isActive) {
                        throw new Error('CUSTOMER_INACTIVE');
                    }
                    currentSession = await tx.diningSession.create({
                        data: {
                            tenantId: tenant.id,
                            tableId: safeTableId,
                            customerId: customer.id,
                            partySize: 1,
                            sessionStatus: 'OPEN',
                            source: 'public_order',
                        },
                        select: {
                            id: true,
                            tableId: true,
                            customerId: true,
                            sessionStatus: true,
                        },
                    });
                }
                if (!currentSession) {
                    throw new Error('SESSION_NOT_FOUND');
                }
                const createdOrder = await tx.order.create({
                    data: {
                        diningSessionId: currentSession.id,
                        tenantId: tenant.id,
                        tableId: safeTableId || currentSession.tableId,
                        customerName,
                        customerPhone,
                        orderNumber,
                        orderType: orderType,
                        subtotal,
                        taxAmount,
                        discountAmount: 0,
                        totalAmount,
                        items: {
                            create: orderItemsCreate,
                        },
                    },
                    select: publicOrderSelect,
                });
                await tx.diningSession.update({
                    where: { id: currentSession.id },
                    data: { sessionStatus: 'ACTIVE' },
                });
                const tableIdToUpdate = safeTableId || currentSession.tableId || null;
                if (tableIdToUpdate) {
                    await tx.table.update({
                        where: { id: tableIdToUpdate },
                        data: {
                            status: 'ORDERING_OPEN',
                            currentOrderId: createdOrder.id,
                            currentSessionId: currentSession.id,
                        },
                    });
                }
                return { createdOrder, currentSession };
            });
            order = txResult.createdOrder;
            lockedSession = txResult.currentSession;
        }
        catch (err) {
            console.error('createOrder prisma.$transaction failed', {
                tenantSlug,
                resolvedSessionId: resolvedSession?.id,
                safeTableId,
                itemsSummary: Array.isArray(items) ? `${items.length} items` : typeof items,
                idempotencyKey: requestIdempotencyKey || null,
                error: err && (err instanceof Error ? err.stack || err.message : String(err)),
            });
            throw err;
        }
        if (!lockedSession) {
            throw new Error('SESSION_NOT_FOUND');
        }
        const tableIdToUpdate = safeTableId || lockedSession.tableId || null;
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenant.id)).emit('order:new', order);
        (0, socket_1.getIO)().to((0, socket_1.getSessionRoom)(tenant.id, lockedSession.id)).emit('order:new', order);
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenant.id)).emit('session:update', {
            sessionId: lockedSession.id,
            status: 'ACTIVE',
            updatedAt: new Date().toISOString(),
        });
        (0, socket_1.getIO)().to((0, socket_1.getSessionRoom)(tenant.id, lockedSession.id)).emit('session:update', {
            sessionId: lockedSession.id,
            status: 'ACTIVE',
            updatedAt: new Date().toISOString(),
        });
        if (tableIdToUpdate) {
            (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenant.id)).emit('table:status_change', {
                tableId: tableIdToUpdate,
                status: 'ORDERING_OPEN',
                orderNumber,
            });
        }
        await Promise.all([
            invalidateOperationalCaches(tenant.id, lockedSession.id, order.id),
            requestIdempotencyKey
                ? (0, cache_service_1.setCache)(cache_keys_1.cacheKeys.publicOrderIdempotency(tenant.id, requestIdempotencyKey), {
                    ...order,
                    sessionId: lockedSession.id,
                    diningSessionId: lockedSession.id,
                    sessionAccessToken: (0, public_access_1.generateSessionAccessToken)({
                        tenantId: tenant.id,
                        sessionId: lockedSession.id,
                        customerId: lockedSession.customerId,
                        tableId: lockedSession.tableId || null,
                    }),
                }, 600)
                : Promise.resolve(),
        ]);
        return res.status(201).json({
            ...order,
            sessionId: lockedSession.id,
            diningSessionId: lockedSession.id,
            sessionAccessToken: (0, public_access_1.generateSessionAccessToken)({
                tenantId: tenant.id,
                sessionId: lockedSession.id,
                customerId: lockedSession.customerId,
                tableId: lockedSession.tableId || null,
            }),
        });
    }
    catch (error) {
        console.error('createOrder error:', error);
        const message = error instanceof Error ? error.message : 'Failed to create order';
        if (message === 'ORDER_ITEMS_REQUIRED' || message === 'ORDER_ITEMS_INVALID') {
            return res.status(400).json({ error: 'Order items are missing or invalid. Refresh the menu and try again.' });
        }
        if (error instanceof Error &&
            ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)) {
            return res.status(401).json({ error: 'Session access token is required for dine-in orders.' });
        }
        if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
            return res.status(404).json({ error: 'Session not found. Refresh and try again.' });
        }
        if (error instanceof Error && error.message === 'SESSION_NOT_ORDERABLE') {
            return res.status(409).json({ error: 'This session is no longer open for new orders. Refresh and try again.' });
        }
        if (error instanceof Error && error.message === 'CUSTOMER_INACTIVE') {
            return res.status(403).json({ error: 'Customer account is inactive.' });
        }
        if (error instanceof Error && error.message.startsWith('MENU_ITEM_NOT_FOUND:')) {
            return res.status(400).json({ error: 'One or more items are unavailable. Refresh the menu and try again.' });
        }
        if (error instanceof Error && error.message.startsWith('MODIFIER_')) {
            return res.status(400).json({ error: 'One or more modifier selections are invalid. Review the order and try again.' });
        }
        res.status(500).json({
            error: process.env.NODE_ENV === 'production' ? 'Failed to create order' : message
        });
    }
};
exports.createOrder = createOrder;
const getOrderInfo = async (req, res) => {
    try {
        const { tenantSlug, id } = req.params;
        const tenant = await resolveTenantBySlug(tenantSlug);
        // Cache for 2 minutes since orders don't change status *that* frequently 
        // and live updates are handled by Socket.io anyway.
        const cacheKey = cache_keys_1.cacheKeys.publicOrderInfo(tenant.id, id);
        const cachedOrder = await (0, cache_service_1.getCache)(cacheKey);
        if (cachedOrder) {
            if (cachedOrder.diningSession) {
                (0, public_access_1.authorizeSessionAccess)(req, {
                    tenantId: tenant.id,
                    sessionId: cachedOrder.diningSession.id,
                    customerId: cachedOrder.diningSession.customerId,
                    tenantSlug,
                });
            }
            return res.json(cachedOrder);
        }
        const order = await (0, prisma_1.withPrismaRetry)(() => prisma_1.prisma.order.findFirst({
            where: { id, tenantId: tenant.id },
            include: {
                table: true,
                items: true,
                diningSession: {
                    select: {
                        id: true,
                        customerId: true,
                    },
                },
            }
        }), `public-order-info:${tenant.id}:${id}`);
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (order.diningSession) {
            (0, public_access_1.authorizeSessionAccess)(req, {
                tenantId: tenant.id,
                sessionId: order.diningSession.id,
                customerId: order.diningSession.customerId,
                tenantSlug,
            });
        }
        await (0, cache_service_1.setCache)(cacheKey, order, 120);
        res.json(order);
    }
    catch (error) {
        if (error instanceof Error &&
            ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)) {
            return res.status(401).json({ error: 'Session access token is required for this order.' });
        }
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};
exports.getOrderInfo = getOrderInfo;
const getSessionOrders = async (req, res) => {
    try {
        const { tenantSlug, sessionToken: sessionId } = req.params;
        const tenant = await resolveTenantBySlug(tenantSlug);
        const session = await prisma_1.prisma.diningSession.findFirst({
            where: { id: sessionId, tenantId: tenant.id },
            select: { id: true, customerId: true },
        });
        if (!session)
            return res.status(404).json({ error: 'Session not found' });
        (0, public_access_1.authorizeSessionAccess)(req, {
            tenantId: tenant.id,
            sessionId: session.id,
            customerId: session.customerId,
            tenantSlug,
        });
        const cacheKey = cache_keys_1.cacheKeys.sessionOrders(tenant.id, sessionId);
        const cachedOrders = await (0, cache_service_1.getCache)(cacheKey);
        if (cachedOrders)
            return res.json(cachedOrders);
        const orders = await (0, prisma_1.withPrismaRetry)(() => prisma_1.prisma.order.findMany({
            where: {
                tenantId: tenant.id,
                diningSessionId: sessionId,
            },
            include: { table: true, items: true },
            orderBy: { createdAt: 'desc' }
        }), `session-orders:${tenant.id}:${sessionId}`);
        // Parse JSON modifiers before sending
        const parsedOrders = orders.map(o => ({
            ...o,
            items: o.items.map(i => ({
                ...i,
                modifiers: typeof i.selectedModifiers === 'string' ? JSON.parse(i.selectedModifiers) : i.selectedModifiers
            }))
        }));
        await (0, cache_service_1.setCache)(cacheKey, parsedOrders, 30); // 30-second cache
        res.json(parsedOrders);
    }
    catch (error) {
        if (error instanceof Error &&
            ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)) {
            return res.status(401).json({ error: 'Session access token is required for this session.' });
        }
        res.status(500).json({ error: 'Failed to fetch session orders' });
    }
};
exports.getSessionOrders = getSessionOrders;
const submitFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const overallRating = normalizeStarRating(req.body?.overallRating ?? req.body?.rating);
        const foodRating = normalizeStarRating(req.body?.foodRating);
        const serviceRating = normalizeStarRating(req.body?.serviceRating);
        const comment = readOptionalString(req.body?.comment) ?? readOptionalString(req.body?.feedback);
        const tipAmount = readOptionalNumber(req.body?.tipAmount) ?? 0;
        const requestedStaffName = readOptionalString(req.body?.serviceStaffName);
        const ratingValues = [overallRating, foodRating, serviceRating].filter((value) => Number.isFinite(value));
        if (ratingValues.length === 0) {
            return res.status(400).json({ error: 'At least one rating is required' });
        }
        if (ratingValues.some((value) => value < 1 || value > 5)) {
            return res.status(400).json({ error: 'Ratings must be between 1 and 5' });
        }
        if (tipAmount < 0) {
            return res.status(400).json({ error: 'Tip amount cannot be negative' });
        }
        const derivedOverallRating = overallRating ??
            Math.max(1, Math.min(5, Math.round(ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length)));
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                tenantId: true,
                diningSessionId: true,
                status: true,
                diningSession: {
                    select: {
                        id: true,
                        customerId: true,
                        sessionStatus: true,
                        attendedByName: true,
                        attendedByUserId: true,
                        bill: {
                            select: {
                                paymentStatus: true,
                            },
                        },
                    },
                },
            },
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (order.diningSessionId) {
            (0, public_access_1.authorizeSessionAccess)(req, {
                tenantId: order.tenantId,
                sessionId: order.diningSession.id,
                customerId: order.diningSession.customerId,
            });
            const sessionStatus = String(order.diningSession?.sessionStatus || '').toUpperCase();
            const paymentStatus = String(order.diningSession?.bill?.paymentStatus || '').toUpperCase();
            if (sessionStatus !== 'CLOSED' || paymentStatus !== 'PAID') {
                return res.status(409).json({ error: 'Review is available only after payment is settled.' });
            }
        }
        else if (String(order.status || '').toUpperCase() !== 'RECEIVED') {
            return res.status(409).json({ error: 'Review is available only after the order is completed.' });
        }
        const resolvedServiceStaffName = requestedStaffName || order.diningSession?.attendedByName || undefined;
        const resolvedServiceStaffUserId = order.diningSession?.attendedByUserId || undefined;
        // Keep feedback idempotent across the whole dining session.
        // A session allows only one review row, while multiple orders may exist.
        const existingSessionReview = await prisma_1.prisma.review.findFirst({
            where: order.diningSessionId ? { diningSessionId: order.diningSessionId } : { orderId: order.id },
            select: { id: true, orderId: true },
        });
        if (existingSessionReview) {
            const review = await prisma_1.prisma.review.update({
                where: { id: existingSessionReview.id },
                data: {
                    overallRating: derivedOverallRating,
                    foodRating: foodRating ?? derivedOverallRating,
                    serviceRating: serviceRating ?? derivedOverallRating,
                    comment,
                    tipAmount,
                    serviceStaffName: resolvedServiceStaffName,
                    serviceStaffUserId: resolvedServiceStaffUserId,
                    ...(existingSessionReview.orderId ? {} : { orderId: order.id }),
                },
            });
            if (order.diningSessionId) {
                await prisma_1.prisma.order.updateMany({
                    where: { diningSessionId: order.diningSessionId, status: { not: 'CANCELLED' } },
                    data: { hasReview: true },
                });
            }
            else {
                await prisma_1.prisma.order.update({
                    where: { id },
                    data: { hasReview: true },
                });
            }
            return res.json({ success: true, review });
        }
        else {
            const review = await prisma_1.prisma.review.create({
                data: {
                    tenantId: order.tenantId,
                    orderId: order.id,
                    diningSessionId: order.diningSessionId,
                    customerId: order.diningSession?.customerId,
                    overallRating: derivedOverallRating,
                    foodRating: foodRating ?? derivedOverallRating,
                    serviceRating: serviceRating ?? derivedOverallRating,
                    comment,
                    tipAmount,
                    serviceStaffName: resolvedServiceStaffName,
                    serviceStaffUserId: resolvedServiceStaffUserId,
                },
            });
            if (order.diningSessionId) {
                await prisma_1.prisma.order.updateMany({
                    where: { diningSessionId: order.diningSessionId, status: { not: 'CANCELLED' } },
                    data: { hasReview: true },
                });
            }
            else {
                await prisma_1.prisma.order.update({
                    where: { id },
                    data: { hasReview: true },
                });
            }
            return res.json({ success: true, review });
        }
    }
    catch (error) {
        console.error('submitFeedback error:', error);
        if (error instanceof Error &&
            ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)) {
            return res.status(401).json({ error: 'Session access token is required to submit feedback for this order.' });
        }
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
};
exports.submitFeedback = submitFeedback;
const waiterCall = async (req, res) => {
    try {
        const { tenantSlug } = req.params;
        const tableId = readOptionalString(req.body?.tableId);
        const sessionId = readOptionalString(req.body?.sessionId);
        const type = readOptionalString(req.body?.type)?.toUpperCase() || 'WAITER';
        if (!WAITER_CALL_TYPES.has(type)) {
            return res.status(400).json({ error: 'Invalid waiter call type' });
        }
        if (!sessionId) {
            return res.status(401).json({ error: 'Session access token is required.' });
        }
        const tenantId = await resolveTenantIdBySlug(tenantSlug);
        const session = await prisma_1.prisma.diningSession.findFirst({
            where: { id: sessionId, tenantId },
            select: { id: true, customerId: true, tableId: true },
        });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        (0, public_access_1.authorizeSessionAccess)(req, {
            tenantId,
            sessionId: session.id,
            customerId: session.customerId,
            tenantSlug,
        });
        if (tableId && session.tableId && tableId !== session.tableId) {
            return res.status(400).json({ error: 'Waiter call table mismatch. Please refresh the session and try again.' });
        }
        const resolvedTableId = session.tableId || tableId;
        const tableName = await resolveWaiterTableName(tenantId, resolvedTableId || undefined);
        const payload = {
            tableId: resolvedTableId,
            tableName,
            type,
            sessionId: session.id,
            timestamp: new Date().toISOString(),
        };
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenantId)).emit('waiter:call', payload);
        res.json({ success: true, table: tableName, sessionId: session.id });
    }
    catch (error) {
        console.error('waiterCall error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        if (error instanceof Error &&
            ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)) {
            return res.status(401).json({ error: 'Session access token is required.' });
        }
        res.status(message === 'Restaurant not found' ? 404 : 500).json({ error: message });
    }
};
exports.waiterCall = waiterCall;
/**
 * Staff Acknowledgment of a waiter call.
 * This notifies the specific guest that help is arriving.
 */
const acknowledgeWaiterCall = async (req, res) => {
    try {
        const { tenantSlug } = req.params;
        const sessionId = readOptionalString(req.body?.sessionId);
        const tableId = readOptionalString(req.body?.tableId);
        if (!sessionId) {
            return res.status(400).json({ error: 'Session or guest token is required' });
        }
        const tenantId = await resolveTenantIdBySlug(tenantSlug);
        const session = await prisma_1.prisma.diningSession.findFirst({
            where: { id: sessionId, tenantId },
            select: { id: true },
        });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const sessionRoom = (0, socket_1.getSessionRoom)(tenantId, session.id);
        (0, socket_1.getIO)().to(sessionRoom).emit('waiter:acknowledged', {
            sessionId: session.id,
            tableId,
            status: 'ACCEPTED',
            timestamp: new Date().toISOString(),
        });
        res.json({ success: true, sessionId: session.id });
    }
    catch (error) {
        console.error('acknowledgeWaiterCall error:', error);
        const message = error instanceof Error ? error.message : 'Failed to notify guest';
        res.status(message === 'Restaurant not found' ? 404 : 500).json({ error: message });
    }
};
exports.acknowledgeWaiterCall = acknowledgeWaiterCall;
const updateOrderStatusPublic = async (req, res) => {
    try {
        const { tenantSlug, id } = req.params;
        const { status, version } = req.body;
        if (status !== 'SERVED') {
            return res.status(400).json({ error: 'Customers can only mark orders as served (received).' });
        }
        const tenantId = await resolveTenantIdBySlug(tenantSlug);
        // Verify order belongs to this session
        const order = await prisma_1.prisma.order.findFirst({
            where: { id, tenantId },
            select: {
                id: true,
                version: true,
                diningSessionId: true,
                diningSession: {
                    select: {
                        id: true,
                        customerId: true,
                    },
                },
            }
        });
        if (!order || !order.diningSessionId || !order.diningSession) {
            return res.status(404).json({ error: 'Order not found in this session.' });
        }
        (0, public_access_1.authorizeSessionAccess)(req, {
            tenantId,
            sessionId: order.diningSession.id,
            customerId: order.diningSession.customerId,
            tenantSlug,
        });
        const updatedOrder = await (0, order_service_1.transitionOrderStatus)({
            orderId: id,
            tenantId,
            expectedVersion: version || order.version,
            newStatus: 'SERVED',
            actorId: order.diningSessionId,
            actorType: 'CUSTOMER',
        });
        // Notify Vendor Socket
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenantId)).emit('order:update', updatedOrder);
        // Notify Session Socket
        (0, socket_1.getIO)().to((0, socket_1.getSessionRoom)(tenantId, order.diningSessionId)).emit('order:update', updatedOrder);
        await invalidateOperationalCaches(tenantId, order.diningSessionId, id);
        res.json(updatedOrder);
    }
    catch (error) {
        console.error('updateOrderStatusPublic error:', error);
        const message = error instanceof Error ? error.message : 'Failed to update order status';
        if (error instanceof Error &&
            ['SESSION_ACCESS_REQUIRED', 'SESSION_ACCESS_MISMATCH', 'INVALID_SESSION_ACCESS_TOKEN'].includes(error.message)) {
            return res.status(401).json({ error: 'Session access token is required to update this order.' });
        }
        if (error instanceof order_service_1.ConflictError || message === 'OCC_COLLISION') {
            return res.status(409).json({ error: 'Order status changed on another device. Refresh and try again.' });
        }
        res.status(500).json({ error: message });
    }
};
exports.updateOrderStatusPublic = updateOrderStatusPublic;
//# sourceMappingURL=public.controller.js.map