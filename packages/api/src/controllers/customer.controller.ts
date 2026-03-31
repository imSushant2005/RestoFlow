import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * POST /customer/login
 * Login with phone + name (no OTP for MVP)
 * Creates customer if not exists, returns JWT
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { phone, name } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    let customer = await prisma.customer.findUnique({ where: { phone } });

    if (customer) {
      // Update lastSeenAt and name if provided
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          lastSeenAt: new Date(),
          ...(name && { name }),
        },
      });
    } else {
      // Create new customer
      customer = await prisma.customer.create({
        data: {
          phone,
          name: name || null,
        },
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { customerId: customer.id, phone: customer.phone },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        createdAt: customer.createdAt,
      },
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * GET /customer/profile
 * Get customer profile (requires customer JWT)
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    if (!customerId) return res.status(401).json({ error: 'Not authenticated' });

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    res.json(customer);
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * GET /customer/history
 * Get all completed dining sessions with orders + bills
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    if (!customerId) return res.status(401).json({ error: 'Not authenticated' });

    const sessions = await prisma.diningSession.findMany({
      where: {
        customerId,
        sessionStatus: 'CLOSED' as any,
      },
      include: {
        tenant: {
          select: { businessName: true, slug: true, logoUrl: true },
        },
        table: { select: { name: true } },
        bill: true,
        orders: {
          include: {
            items: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        review: { select: { overallRating: true, comment: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });

    res.json(sessions);
  } catch (error) {
    console.error('getHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

/**
 * GET /customer/history/:sessionId
 * Get a single session detail with full bill + orders
 */
export const getSessionDetail = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { sessionId } = req.params;
    if (!customerId) return res.status(401).json({ error: 'Not authenticated' });

    const session = await prisma.diningSession.findFirst({
      where: { id: sessionId, customerId },
      include: {
        tenant: {
          select: { businessName: true, slug: true, logoUrl: true, taxRate: true, currency: true, currencySymbol: true },
        },
        table: { select: { name: true } },
        bill: true,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
        review: true,
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json(session);
  } catch (error) {
    console.error('getSessionDetail error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};
