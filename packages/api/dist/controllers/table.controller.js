"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTable = exports.createSession = exports.updateTableStatus = exports.updateTablePosition = exports.createTable = exports.createZone = exports.getZones = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const socket_1 = require("../socket");
const getZones = async (req, res) => {
    try {
        console.log('Fetching zones for tenant:', req.tenantId);
        const zones = await prisma_1.prisma.zone.findMany({
            where: { tenantId: req.tenantId },
            include: {
                tables: {
                    include: {
                        orders: {
                            where: {
                                status: { in: ['NEW', 'ACCEPTED', 'PREPARING'] }
                            }
                        }
                    }
                }
            }
        });
        // Send back the tenant slug as well for convenient QR generation on the frontend
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
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
        const { name } = req.body;
        const zone = await prisma_1.prisma.zone.create({
            data: {
                name,
                tenantId: req.tenantId,
            },
        });
        res.status(201).json(zone);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create zone' });
    }
};
exports.createZone = createZone;
const createTable = async (req, res) => {
    try {
        const { name, zoneId, x, y, seats } = req.body;
        console.log('Creating table:', { name, zoneId, x, y, seats });
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        // Check for duplicate table name in the same zone
        const existingTable = await prisma_1.prisma.table.findFirst({
            where: {
                name,
                zoneId,
                tenantId: req.tenantId
            }
        });
        if (existingTable) {
            return res.status(400).json({ error: `Table '${name}' already exists in this zone.` });
        }
        console.log('Tenant plan inside createTable:', tenant.plan);
        const count = await prisma_1.prisma.table.count({ where: { tenantId: req.tenantId } });
        console.log('Current table count:', count);
        if (count >= plans_1.PLAN_LIMITS[tenant.plan].tables) {
            return res.status(403).json({ error: `Plan limit reached. Your ${tenant.plan} plan allows up to ${plans_1.PLAN_LIMITS[tenant.plan].tables} tables.` });
        }
        const table = await prisma_1.prisma.table.create({
            data: {
                name,
                zoneId,
                positionX: x || 50,
                positionY: y || 50,
                capacity: seats ? parseInt(seats.toString(), 10) : 4,
                tenantId: req.tenantId,
            },
        });
        console.log('Table created:', table);
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
        const { sessionId, name, phoneNumber, seat } = req.body;
        const table = await prisma_1.prisma.table.findUnique({ where: { id } });
        if (!table)
            return res.status(404).json({ error: 'Table not found' });
        // V2: Actually create the CustomerSession row
        let session;
        try {
            session = await prisma_1.prisma.customerSession.create({
                data: {
                    tenantId: table.tenantId,
                    tableId: table.id,
                    anonymousId: sessionId || Math.random().toString(36).substring(7),
                }
            });
        }
        catch (sessionError) {
            console.error('Session create minimal error', sessionError);
            return res.json({
                success: true,
                sessionId: sessionId || null,
                anonymousId: sessionId || null
            });
        }
        if (seat) {
            const currentOccupied = table.occupiedSeats || [];
            if (!currentOccupied.includes(seat.toString())) {
                const updatedTable = await prisma_1.prisma.table.update({
                    where: { id: table.id },
                    data: { occupiedSeats: { push: seat.toString() } }
                });
                (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(table.tenantId)).emit('table:status_change', { tableId: table.id, status: updatedTable.status });
            }
        }
        else {
            if (table.status !== 'OCCUPIED') {
                await prisma_1.prisma.table.update({
                    where: { id: table.id },
                    data: { status: 'OCCUPIED' }
                });
                (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(table.tenantId)).emit('table:status_change', { tableId: table.id, status: 'OCCUPIED' });
            }
        }
        res.json({ success: true, sessionId: session.id, anonymousId: session.anonymousId });
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