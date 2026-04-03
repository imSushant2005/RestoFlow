"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waiterCall = exports.submitFeedback = exports.getSessionOrders = exports.getOrderInfo = exports.createOrder = exports.resolveCustomDomain = exports.getPublicMenu = void 0;
const prisma_1 = require("../db/prisma");
const socket_1 = require("../socket");
const cache_service_1 = require("../services/cache.service");
const getPublicMenu = async (req, res) => {
    try {
        const { tenantSlug } = req.params;
        const cacheKey = `public_menu_${tenantSlug}`;
        const cachedMenu = await (0, cache_service_1.getCache)(cacheKey);
        // Bust cache if it's missing the `name` field (old format)
        if (cachedMenu && cachedMenu.name)
            return res.json(cachedMenu);
        if (cachedMenu && !cachedMenu.name)
            await (0, cache_service_1.deleteCache)(cacheKey);
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            include: {
                categories: {
                    where: { isVisible: true },
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        menuItems: {
                            where: { isAvailable: true },
                            orderBy: { sortOrder: 'asc' },
                            include: {
                                modifierGroups: {
                                    include: {
                                        modifiers: {
                                            where: { isAvailable: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!tenant)
            return res.status(404).json({ error: 'Vendor not found' });
        const publicData = {
            tenantId: tenant.id,
            name: tenant.businessName, // alias used by customer frontend
            businessName: tenant.businessName,
            description: tenant.description || '',
            slug: tenant.slug,
            logoUrl: tenant.logoUrl || null,
            coverImageUrl: tenant.coverImageUrl || null,
            categories: tenant.categories,
            primaryColor: tenant.primaryColor,
            accentColor: tenant.accentColor,
            taxRate: tenant.taxRate,
        };
        await (0, cache_service_1.setCache)(cacheKey, publicData, 3600); // 1-hour cache
        res.json(publicData);
    }
    catch (error) {
        console.error('getPublicMenu error:', error);
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
};
exports.getPublicMenu = getPublicMenu;
const resolveCustomDomain = async (req, res) => {
    try {
        const domain = req.query.domain;
        if (!domain)
            return res.status(400).json({ error: 'Domain missing' });
        // In a prod system, you'd match against a specific `customDomain` field.
        // For V3 upgrade, we map against the `website` URL field dynamically.
        const tenant = await prisma_1.prisma.tenant.findFirst({
            where: { website: { contains: domain } },
            select: { slug: true }
        });
        if (!tenant)
            return res.status(404).json({ error: 'Domain not mapped to any tenant' });
        res.json({ success: true, slug: tenant.slug });
    }
    catch (error) {
        res.status(500).json({ error: 'Resolver failed' });
    }
};
exports.resolveCustomDomain = resolveCustomDomain;
const createOrder = async (req, res) => {
    try {
        const { tenantSlug } = req.params;
        const { sessionId, sessionToken, items, tableId, customerName, customerPhone } = req.body;
        const incomingSessionToken = sessionId || sessionToken || null;
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (!tenant)
            return res.status(404).json({ error: 'Vendor not found' });
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order must include at least one item' });
        }
        let safeTableId = null;
        if (tableId) {
            const table = await prisma_1.prisma.table.findFirst({
                where: {
                    id: tableId,
                    tenantId: tenant.id
                },
                select: { id: true }
            });
            safeTableId = table?.id || null;
        }
        let resolvedSession = incomingSessionToken
            ? await prisma_1.prisma.diningSession.findFirst({
                where: {
                    id: incomingSessionToken,
                    tenantId: tenant.id,
                    sessionStatus: { notIn: ['CLOSED', 'CANCELLED'] },
                },
            })
            : null;
        // If caller didn't pass a sessionId, try joining the active table session first.
        if (!resolvedSession && safeTableId) {
            resolvedSession = await prisma_1.prisma.diningSession.findFirst({
                where: {
                    tenantId: tenant.id,
                    tableId: safeTableId,
                    sessionStatus: { notIn: ['CLOSED', 'CANCELLED'] },
                },
                orderBy: { openedAt: 'desc' },
            });
        }
        // Always anchor orders to a DiningSession (legacy CustomerSession removed from runtime flow).
        if (!resolvedSession) {
            const normalizedPhone = typeof customerPhone === 'string' && customerPhone.trim().length > 0
                ? customerPhone.trim()
                : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            let customer = await prisma_1.prisma.customer.findUnique({ where: { phone: normalizedPhone } });
            if (!customer) {
                customer = await prisma_1.prisma.customer.create({
                    data: {
                        phone: normalizedPhone,
                        name: typeof customerName === 'string' && customerName.trim().length > 0 ? customerName.trim() : null,
                    },
                });
            }
            resolvedSession = await prisma_1.prisma.diningSession.create({
                data: {
                    tenantId: tenant.id,
                    tableId: safeTableId,
                    customerId: customer.id,
                    partySize: 1,
                    sessionStatus: 'OPEN',
                    source: 'public_order',
                },
            });
        }
        const menuItemIds = items
            .map((item) => item?.menuItemId || item?.menuItem?.id)
            .filter((id) => typeof id === 'string');
        if (menuItemIds.length === 0) {
            return res.status(400).json({ error: 'Order must include valid menu item ids' });
        }
        const menuItems = await prisma_1.prisma.menuItem.findMany({
            where: { tenantId: tenant.id, id: { in: menuItemIds } },
            include: {
                modifierGroups: {
                    include: {
                        modifiers: {
                            where: { isAvailable: true },
                        },
                    },
                },
            },
        });
        const menuMap = new Map(menuItems.map((m) => [m.id, m]));
        let subtotal = 0;
        const orderItemsCreate = items.map((item) => {
            const menuItemId = item?.menuItemId || item?.menuItem?.id;
            const menuItem = menuMap.get(menuItemId);
            if (!menuItem) {
                throw new Error(`Menu item not found: ${menuItemId}`);
            }
            const modifiers = Array.isArray(item.selectedModifiers)
                ? item.selectedModifiers
                : Array.isArray(item.modifiers)
                    ? item.modifiers
                    : [];
            const quantity = Number(item.quantity) || 0;
            if (quantity <= 0) {
                throw new Error('Invalid item quantity');
            }
            let unitPrice = menuItem.price;
            const modifierMap = new Map((menuItem.modifierGroups || [])
                .flatMap((group) => (group.modifiers || []).map((modifier) => [
                modifier.id,
                {
                    id: modifier.id,
                    name: modifier.name,
                    groupName: group.name,
                    priceAdjustment: Number(modifier.priceAdjustment || 0),
                },
            ])));
            const selectedMods = modifiers.map((mod) => {
                const dbModifier = mod?.id ? modifierMap.get(mod.id) : null;
                if (!dbModifier)
                    return null;
                unitPrice += dbModifier.priceAdjustment;
                return {
                    id: dbModifier.id,
                    name: dbModifier.name,
                    groupName: dbModifier.groupName,
                    priceAdjustment: dbModifier.priceAdjustment,
                };
            }).filter(Boolean);
            const totalPrice = unitPrice * quantity;
            subtotal += totalPrice;
            return {
                menuItemId: menuItem.id,
                name: menuItem.name,
                description: menuItem.description || '',
                imageUrl: menuItem.images?.[0] || null,
                unitPrice,
                quantity,
                totalPrice,
                specialNote: item.notes || '',
                selectedModifiers: selectedMods
            };
        });
        const taxAmount = subtotal * (tenant.taxRate / 100);
        const totalAmount = subtotal + taxAmount;
        // Generate order number
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let orderNumber = '';
        let exists = true;
        while (exists) {
            orderNumber = '#' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            const check = await prisma_1.prisma.order.findFirst({ where: { tenantId: tenant.id, orderNumber } });
            exists = !!check;
        }
        let order;
        try {
            order = await prisma_1.prisma.order.create({
                data: {
                    diningSessionId: resolvedSession.id,
                    tenantId: tenant.id,
                    tableId: safeTableId || resolvedSession.tableId,
                    customerName,
                    customerPhone,
                    orderNumber,
                    subtotal,
                    taxAmount,
                    discountAmount: 0,
                    totalAmount,
                    items: {
                        create: orderItemsCreate
                    }
                },
                include: { table: true, items: { include: { menuItem: true } } }
            });
        }
        catch (primaryCreateError) {
            console.error('createOrder primary create error:', primaryCreateError);
            order = await prisma_1.prisma.order.create({
                data: {
                    diningSessionId: resolvedSession.id,
                    tableId: safeTableId || resolvedSession.tableId,
                    tenantId: tenant.id,
                    customerName,
                    customerPhone,
                    orderNumber,
                    subtotal,
                    taxAmount,
                    discountAmount: 0,
                    totalAmount,
                    items: {
                        create: orderItemsCreate.map((item) => ({
                            ...item,
                            menuItemId: null
                        }))
                    }
                },
                include: { table: true, items: { include: { menuItem: true } } }
            });
        }
        // Table-sync failure should never turn a successful order into a client-visible 500.
        const tableIdToUpdate = safeTableId || resolvedSession.tableId || null;
        if (tableIdToUpdate) {
            try {
                await prisma_1.prisma.table.update({
                    where: { id: tableIdToUpdate },
                    data: { status: 'ORDERING_OPEN', currentOrderId: order.id, currentSessionId: resolvedSession.id }
                });
                (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenant.id)).emit('table:status_change', { tableId: tableIdToUpdate, status: 'ORDERING_OPEN', orderNumber });
            }
            catch (tableError) {
                console.error('createOrder table sync error:', tableError);
            }
        }
        await prisma_1.prisma.diningSession.update({
            where: { id: resolvedSession.id },
            data: { sessionStatus: 'ACTIVE' },
        });
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenant.id)).emit('order:new', order);
        (0, socket_1.getIO)().to((0, socket_1.getSessionRoom)(tenant.id, resolvedSession.id)).emit('order:new', order);
        res.status(201).json(order);
    }
    catch (error) {
        console.error('createOrder error:', error);
        const message = error instanceof Error ? error.message : 'Failed to create order';
        res.status(500).json({
            error: process.env.NODE_ENV === 'production' ? 'Failed to create order' : message
        });
    }
};
exports.createOrder = createOrder;
const getOrderInfo = async (req, res) => {
    try {
        const { id } = req.params;
        // Cache for 2 minutes since orders don't change status *that* frequently 
        // and live updates are handled by Socket.io anyway.
        const cacheKey = `order_info_${id}`;
        const cachedOrder = await (0, cache_service_1.getCache)(cacheKey);
        if (cachedOrder)
            return res.json(cachedOrder);
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            include: { table: true, items: { include: { menuItem: true } } }
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        await (0, cache_service_1.setCache)(cacheKey, order, 120);
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};
exports.getOrderInfo = getOrderInfo;
const getSessionOrders = async (req, res) => {
    try {
        const { tenantSlug, sessionToken } = req.params;
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: { id: true }
        });
        if (!tenant)
            return res.status(404).json({ error: 'Vendor not found' });
        const cacheKey = `session_orders_${sessionToken}`;
        const cachedOrders = await (0, cache_service_1.getCache)(cacheKey);
        if (cachedOrders)
            return res.json(cachedOrders);
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                tenantId: tenant.id,
                diningSessionId: sessionToken,
            },
            include: { table: true, items: { include: { menuItem: true } } },
            orderBy: { createdAt: 'desc' }
        });
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
        res.status(500).json({ error: 'Failed to fetch session orders' });
    }
};
exports.getSessionOrders = getSessionOrders;
const submitFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, feedback } = req.body;
        const order = await prisma_1.prisma.order.findUnique({ where: { id } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        // V2 uses Review table instead of tying directly to Order
        await prisma_1.prisma.review.create({
            data: {
                tenantId: order.tenantId,
                orderId: order.id,
                diningSessionId: order.diningSessionId,
                overallRating: rating,
                comment: feedback,
            }
        });
        const updatedOrder = await prisma_1.prisma.order.update({
            where: { id },
            data: { hasReview: true },
        });
        res.json(updatedOrder);
    }
    catch (error) {
        console.error('submitFeedback error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
};
exports.submitFeedback = submitFeedback;
const waiterCall = async (req, res) => {
    try {
        const { tenantSlug } = req.params;
        const { tableId, type } = req.body; // type: WAITER | BILL | HELP
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (!tenant)
            return res.status(404).json({ error: 'Restaurant not found' });
        let tableName = 'Unknown';
        if (tableId) {
            const table = await prisma_1.prisma.table.findUnique({ where: { id: tableId } });
            if (table)
                tableName = table.name;
        }
        // Emit to dashboard and KDS via Socket.io
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(tenant.id)).emit('waiter:call', {
            tableId,
            tableName,
            type: type || 'WAITER',
            timestamp: new Date().toISOString(),
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('waiterCall error:', error);
        res.status(500).json({ error: 'Failed to send waiter call' });
    }
};
exports.waiterCall = waiterCall;
//# sourceMappingURL=public.controller.js.map