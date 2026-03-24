import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { PLAN_LIMITS } from '../config/plans';
import { UserRole } from '@dineflow/prisma';
import { hashPassword } from '../utils/hash';

export const getBusinessSettings = async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        businessName: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        primaryColor: true,
        accentColor: true,
        isActive: true,
      }
    });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateBusinessSettings = async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      slug,
      description,
      primaryColor,
      accentColor,
      logoUrl,
      coverImageUrl,
      isActive,
    } = req.body;
    
    // Check if slug is taken by another tenant
    if (slug) {
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (existing && existing.id !== req.tenantId) {
        return res.status(400).json({ error: 'Slug already taken' });
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        businessName,
        slug,
        description,
        primaryColor,
        accentColor,
        logoUrl,
        coverImageUrl,
        isActive,
      },
      select: {
        id: true,
        businessName: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        primaryColor: true,
        accentColor: true,
        isActive: true,
      }
    });
    
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

export const getStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const { email, name, password, role } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    
    const count = await prisma.user.count({ where: { tenantId: req.tenantId } });
    const planLimits = PLAN_LIMITS[tenant.plan as keyof typeof PLAN_LIMITS];
    
    if (planLimits && count >= planLimits.staff) {
      return res.status(403).json({ error: `Plan limit reached. Your ${tenant.plan} plan allows up to ${planLimits.staff} staff members.` });
    }

    const existing = await prisma.user.findFirst({ where: { email, tenantId: req.tenantId as string } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        role: role as UserRole,
        tenantId: req.tenantId as string
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create staff' });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting oneself
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id, tenantId: req.tenantId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete staff' });
  }
};
