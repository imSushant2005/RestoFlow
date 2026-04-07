import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { PLAN_LIMITS } from '../config/plans';
import { getIO, getTenantRoom } from '../socket';

export const getZones = async (req: Request, res: Response) => {
  try {
    console.log('Fetching zones for tenant:', req.tenantId);
    const zones = await prisma.zone.findMany({
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
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId! }});
    res.json({ zones, tenantSlug: tenant?.slug });
  } catch (error) {
    console.error('getZones error:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
};

export const createZone = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const zone = await prisma.zone.create({
      data: {
        name,
        tenantId: req.tenantId!,
      },
    });
    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create zone' });
  }
};

export const createTable = async (req: Request, res: Response) => {
  try {
    const { name, zoneId, x, y, seats } = req.body;
    console.log('Creating table:', { name, zoneId, x, y, seats });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    
    // Check for duplicate table name in the same zone
    const existingTable = await prisma.table.findFirst({
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
    const count = await prisma.table.count({ where: { tenantId: req.tenantId } });
    console.log('Current table count:', count);
    
    if (count >= PLAN_LIMITS[tenant.plan].tables) {
      return res.status(403).json({ error: `Plan limit reached. Your ${tenant!.plan} plan allows up to ${PLAN_LIMITS[tenant!.plan].tables} tables.` });
    }

    const table = await prisma.table.create({
      data: {
        name,
        zoneId,
        positionX: x || 50,
        positionY: y || 50,
        capacity: seats ? parseInt(seats.toString(), 10) : 4,
        tenantId: req.tenantId!,
      },
    });
    console.log('Table created:', table);
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
