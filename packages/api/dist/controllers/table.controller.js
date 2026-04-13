"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTable = exports.createSession = exports.updateTableStatus = exports.updateTablePosition = exports.createTable = exports.createZone = exports.getZones = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const socket_1 = require("../socket");
const getZones = async (req, res) => {
    try {
        const [zones, tenant] = await Promise.all([
            prisma_1.prisma.zone.findMany({
                where: { tenantId: req.tenantId },
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    tenantId: true,
                    name: true,
                    color: true,
                    sortOrder: true,
                    tables: {
                        orderBy: { name: 'asc' },
                        select: {
                            id: true,
                            name: true,
                            capacity: true,
                            seats: true,
                            occupiedSeats: true,
                            status: true,
                            orders: {
                                where: {
                                    status: { in: ['NEW', 'ACCEPTED', 'PREPARING'] },
                                },
                                select: { id: true, status: true },
                            },
                        },
                    },
                },
            }),
            prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { slug: true } }),
        ]);
        res.json({ zones, tenantSlug: tenant?.slug });
    }
    catch (error) {
        console.error('getZones error:', error);
        res.status(500).json({ error: 'Failed to fetch zones' });
    }
};
exports.getZones = getZones;
const createZone = async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        if (!name) {
            return res.status(400).json({ error: 'Zone name is required' });
        }
        const existingZone = await prisma_1.prisma.zone.findFirst({
            where: {
                tenantId: req.tenantId,
                name: { equals: name, mode: 'insensitive' },
            },
            select: { id: true },
        });
        if (existingZone) {
            return res.status(409).json({ error: `Zone '${name}' already exists.` });
        }
        const zone = await prisma_1.prisma.zone.create({
            data: {
                name,
                tenantId: req.tenantId,
            },
        });
        res.status(201).json(zone);
    }
    catch (error) {
        console.error('createZone error:', error);
        res.status(500).json({ error: 'Failed to create zone' });
    }
};
exports.createZone = createZone;
const createTable = async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        const zoneId = String(req.body?.zoneId || '').trim();
        const rawCapacity = req.body?.capacity ?? req.body?.seats;
        const rawX = req.body?.positionX ?? req.body?.x;
        const rawY = req.body?.positionY ?? req.body?.y;
        if (!name) {
            return res.status(400).json({ error: 'Table name is required' });
        }
        if (!zoneId) {
            return res.status(400).json({ error: 'Zone is required' });
        }
        const parsedCapacity = Number(rawCapacity);
        const capacity = Number.isFinite(parsedCapacity)
            ? Math.max(1, Math.min(24, Math.round(parsedCapacity)))
            : 4;
        const parsedX = Number(rawX);
        const parsedY = Number(rawY);
        const positionX = Number.isFinite(parsedX) ? parsedX : 50;
        const positionY = Number.isFinite(parsedY) ? parsedY : 50;
        const [tenant, zone] = await Promise.all([
            prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { id: true, plan: true } }),
            prisma_1.prisma.zone.findFirst({
                where: { id: zoneId, tenantId: req.tenantId },
                select: { id: true },
            }),
        ]);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        if (!zone)
            return res.status(404).json({ error: 'Zone not found' });
        // Check for duplicate table name in the same zone
        const [existingTable, count] = await Promise.all([
            prisma_1.prisma.table.findFirst({
                where: {
                    name: { equals: name, mode: 'insensitive' },
                    zoneId: zone.id,
                    tenantId: req.tenantId,
                },
                select: { id: true },
            }),
            prisma_1.prisma.table.count({ where: { tenantId: req.tenantId } }),
        ]);
        if (existingTable) {
            return res.status(400).json({ error: `Table '${name}' already exists in this zone.` });
        }
        const planLimits = (0, plans_1.getPlanLimits)(tenant.plan);
        if (count >= planLimits.tables) {
            return res.status(403).json({ error: `Plan limit reached. Your ${tenant.plan} plan allows up to ${planLimits.tables} tables.` });
        }
        const table = await prisma_1.prisma.table.create({
            data: {
                name,
                zoneId: zone.id,
                positionX,
                positionY,
                capacity,
                seats: capacity,
                tenantId: req.tenantId,
            },
        });
        res.status(201).json(table);
    }
    catch (error) {
        console.error('Failed to create table error:', error);
        res.status(500).json({ error: 'Failed to create table' });
    }
};
exports.createTable = createTable;
const updateTablePosition = async (req, res) => {
    try {
        const { id } = req.params;
        const { x, y } = req.body;
        const table = await prisma_1.prisma.table.updateMany({
            where: { id, tenantId: req.tenantId },
            data: { positionX: x, positionY: y },
        });
        if (table.count === 0)
            return res.status(404).json({ error: 'Table not found' });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update table position' });
    }
};
exports.updateTablePosition = updateTablePosition;
const updateTableStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const table = await prisma_1.prisma.table.updateMany({
            where: { id, tenantId: req.tenantId },
            data: { status },
        });
        if (table.count === 0)
            return res.status(404).json({ error: 'Table not found' });
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(req.tenantId)).emit('table:status_change', { tableId: id, status });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update table status' });
    }
};
exports.updateTableStatus = updateTableStatus;
const createSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phoneNumber, seat } = req.body;
        const table = await prisma_1.prisma.table.findUnique({ where: { id } });
        if (!table)
            return res.status(404).json({ error: 'Table not found' });
        const activeSession = await prisma_1.prisma.diningSession.findFirst({
            where: {
                tenantId: table.tenantId,
                tableId: table.id,
                sessionStatus: { notIn: ['CLOSED', 'CANCELLED'] },
            },
            orderBy: { openedAt: 'desc' },
            select: { id: true },
        });
        if (activeSession) {
            return res.json({ success: true, sessionId: activeSession.id, anonymousId: activeSession.id });
        }
        const normalizedPhone = typeof phoneNumber === 'string' && phoneNumber.trim().length > 0
            ? phoneNumber.trim()
            : `guest_${table.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let customer = await prisma_1.prisma.customer.findUnique({ where: { phone: normalizedPhone } });
        if (!customer) {
            customer = await prisma_1.prisma.customer.create({
                data: {
                    phone: normalizedPhone,
                    name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : null,
                },
            });
        }
        else if (name && name.trim().length > 0) {
            customer = await prisma_1.prisma.customer.update({
                where: { id: customer.id },
                data: { name: name.trim(), lastSeenAt: new Date() },
            });
        }
        const session = await prisma_1.prisma.diningSession.create({
            data: {
                tenantId: table.tenantId,
                tableId: table.id,
                customerId: customer.id,
                partySize: 1,
                sessionStatus: 'OPEN',
                source: 'legacy_table_session',
            },
        });
        if (seat) {
            const currentOccupied = table.occupiedSeats || [];
            if (!currentOccupied.includes(seat.toString())) {
                const updatedTable = await prisma_1.prisma.table.update({
                    where: { id: table.id },
                    data: { occupiedSeats: { push: seat.toString() }, currentSessionId: session.id, status: 'OCCUPIED' }
                });
                (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(table.tenantId)).emit('table:status_change', { tableId: table.id, status: updatedTable.status });
            }
        }
        else {
            if (table.status !== 'OCCUPIED') {
                await prisma_1.prisma.table.update({
                    where: { id: table.id },
                    data: { status: 'OCCUPIED', currentSessionId: session.id }
                });
                (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(table.tenantId)).emit('table:status_change', { tableId: table.id, status: 'OCCUPIED' });
            }
        }
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(table.tenantId)).emit('session:new', {
            id: session.id,
            tableId: table.id,
            tableName: table.name,
            partySize: 1,
            openedAt: session.openedAt,
        });
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(table.tenantId)).emit('session:update', {
            sessionId: session.id,
            status: 'OPEN',
            updatedAt: new Date().toISOString(),
        });
        res.json({ success: true, sessionId: session.id, anonymousId: session.id });
    }
    catch (error) {
        console.error('Session create error', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
};
exports.createSession = createSession;
const deleteTable = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.table.deleteMany({
            where: { id, tenantId: req.tenantId },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete table' });
    }
};
exports.deleteTable = deleteTable;
//# sourceMappingURL=table.controller.js.map