import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getPlanLimits } from '../config/plans';
import { getIO, getTenantRoom } from '../socket';

export const getZones = async (req: Request, res: Response) => {
  try {
    const [zones, tenant] = await Promise.all([
      prisma.zone.findMany({
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
      prisma.tenant.findUnique({ where: { id: req.tenantId! }, select: { slug: true } }),
    ]);

    res.json({ zones, tenantSlug: tenant?.slug });
  } catch (error) {
    console.error('getZones error:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
};

export const createZone = async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Zone name is required' });
    }

    const [tenant, existingZone, zoneCount] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { plan: true } }),
      prisma.zone.findFirst({
        where: {
          tenantId: req.tenantId,
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      }),
      prisma.zone.count({ where: { tenantId: req.tenantId } }),
    ]);

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (existingZone) {
      return res.status(409).json({ error: `Zone '${name}' already exists.` });
    }

    const planLimits = getPlanLimits(tenant.plan);
    if (zoneCount >= planLimits.maxFloors) {
      return res.status(403).json({ 
        error: `Plan limit reached. Your ${planLimits.name} plan allows up to ${planLimits.maxFloors} floor(s)/zone(s).` 
      });
    }

    const zone = await prisma.zone.create({
      data: {
        name,
        tenantId: req.tenantId!,
      },
    });
    res.status(201).json(zone);
  } catch (error) {
    console.error('createZone error:', error);
    res.status(500).json({ error: 'Failed to create zone' });
  }
};

export const createTable = async (req: Request, res: Response) => {
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
      prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { id: true, plan: true } }),
      prisma.zone.findFirst({
        where: { id: zoneId, tenantId: req.tenantId },
        select: { id: true },
      }),
    ]);

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    
    // Check for duplicate table name in the same zone
    const [existingTable, count] = await Promise.all([
      prisma.table.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          zoneId: zone.id,
          tenantId: req.tenantId,
        },
        select: { id: true },
      }),
      prisma.table.count({ where: { tenantId: req.tenantId } }),
    ]);

    if (existingTable) {
      return res.status(400).json({ error: `Table '${name}' already exists in this zone.` });
    }

    const planLimits = getPlanLimits(tenant.plan);
    if (count >= planLimits.tables) {
      return res.status(403).json({ error: `Plan limit reached. Your ${planLimits.name} plan allows up to ${planLimits.tables} tables.` });
    }

    const table = await prisma.table.create({
      data: {
        name,
        zoneId: zone.id,
        positionX,
        positionY,
        capacity,
        seats: capacity,
        tenantId: req.tenantId!,
      },
    });
    res.status(201).json(table);
  } catch (error) {
    console.error('Failed to create table error:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
};

export const updateTablePosition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { x, y } = req.body;
    const table = await prisma.table.updateMany({
      where: { id, tenantId: req.tenantId },
      data: { positionX: x, positionY: y },
    });
    if (table.count === 0) return res.status(404).json({ error: 'Table not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table position' });
  }
};

export const updateTableStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const table = await prisma.table.updateMany({
      where: { id, tenantId: req.tenantId },
      data: { status },
    });
    if (table.count === 0) return res.status(404).json({ error: 'Table not found' });
    
    getIO().to(getTenantRoom(req.tenantId!)).emit('table:status_change', { tableId: id, status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table status' });
  }
};

export const createSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, seat } = req.body;
    
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const activeSession = await prisma.diningSession.findFirst({
      where: {
        tenantId: table.tenantId,
        tableId: table.id,
        sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
      },
      orderBy: { openedAt: 'desc' },
      select: { id: true },
    });

    if (activeSession) {
      return res.json({ success: true, sessionId: activeSession.id, anonymousId: activeSession.id });
    }

    const normalizedPhone =
      typeof phoneNumber === 'string' && phoneNumber.trim().length > 0
        ? phoneNumber.trim()
        : `guest_${table.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    let customer = await prisma.customer.findUnique({ where: { phone: normalizedPhone } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone: normalizedPhone,
          name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : null,
        },
      });
    } else if (name && name.trim().length > 0) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { name: name.trim(), lastSeenAt: new Date() },
      });
    }

    const session = await prisma.diningSession.create({
      data: {
        tenantId: table.tenantId,
        tableId: table.id,
        customerId: customer.id,
        partySize: 1,
        sessionStatus: 'OPEN' as any,
        source: 'legacy_table_session',
      },
    });

    if (seat) {
      const currentOccupied = table.occupiedSeats || [];
      if (!currentOccupied.includes(seat.toString())) {
        const updatedTable = await prisma.table.update({
          where: { id: table.id },
          data: { occupiedSeats: { push: seat.toString() }, currentSessionId: session.id, status: 'OCCUPIED' }
        });
        getIO().to(getTenantRoom(table.tenantId)).emit('table:status_change', { tableId: table.id, status: updatedTable.status });
      }
    } else {
      if (table.status !== 'OCCUPIED') {
        await prisma.table.update({
          where: { id: table.id },
          data: { status: 'OCCUPIED', currentSessionId: session.id }
        });
        getIO().to(getTenantRoom(table.tenantId)).emit('table:status_change', { tableId: table.id, status: 'OCCUPIED' });
      }
    }
    
    getIO().to(getTenantRoom(table.tenantId)).emit('session:new', {
      id: session.id,
      tableId: table.id,
      tableName: table.name,
      partySize: 1,
      openedAt: session.openedAt,
    });
    getIO().to(getTenantRoom(table.tenantId)).emit('session:update', {
      sessionId: session.id,
      status: 'OPEN',
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, sessionId: session.id, anonymousId: session.id });
  } catch (error) {
    console.error('Session create error', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

export const deleteTable = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.table.deleteMany({
      where: { id, tenantId: req.tenantId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
};
