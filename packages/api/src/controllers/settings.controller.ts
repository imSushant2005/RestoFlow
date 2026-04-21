import { Request, Response } from 'express';
import { prisma, withPrismaRetry } from '../db/prisma';
import { getPlanLimits, normalizePlan } from '../config/plans';
import { UserRole, Plan } from '@dineflow/prisma';
import { hashPassword } from '../utils/hash';
import { z } from 'zod';
import { deleteCache, withCache } from '../services/cache.service';

const createStaffSchema = z
  .object({
    email: z.string().trim().optional(),
    username: z.string().trim().optional(),
    name: z.string().trim().min(1).max(80),
    password: z.string().min(6),
    role: z.string(),
    employeeCode: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, 'Employee ID can only include letters, numbers, - and _')
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.email && !payload.username) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Username is required',
        path: ['username'],
      });
    }
  });

const updateStaffSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.string().optional(),
  email: z.string().trim().optional(),
  username: z.string().trim().optional(),
  employeeCode: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Employee ID can only include letters, numbers, - and _')
    .optional(),
  password: z.string().min(6).optional(),
});

const updateBusinessSettingsSchema = z.object({
  businessName: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  primaryColor: z.string().trim().max(30).optional(),
  accentColor: z.string().trim().max(30).optional(),
  currencySymbol: z.string().trim().min(1).max(8).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  logoUrl: z.string().trim().max(500).optional().nullable(),
  coverImageUrl: z.string().trim().max(500).optional().nullable(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  upiId: z
    .string()
    .trim()
    .regex(/^[a-z0-9.\-_]{2,}@[a-z][a-z0-9.-]{1,}$/i, 'Enter a valid UPI ID')
    .optional()
    .nullable(),
  hasWaiterService: z.boolean().optional(),
  gstin: z.string().trim().min(8).max(20).optional(),
  businessHours: z.unknown().optional(),
  isActive: z.boolean().optional(),
  plan: z.nativeEnum(Plan).optional(),
  trialEndsAt: z.string().pipe(z.coerce.date()).optional().nullable(),
});

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeLoginEmail(raw: string, tenantSlug: string) {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  const handlePart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const handle = sanitizeSegment(handlePart) || 'staff';
  return `${handle}@${tenantSlug}.restoflow`;
}

function defaultEmployeeCode(name: string, tenantSlug: string) {
  const tenantPrefix = sanitizeSegment(tenantSlug).slice(0, 4).toUpperCase() || 'REST';
  const namePrefix = sanitizeSegment(name).replace(/-/g, '').slice(0, 6).toUpperCase() || 'STAFF';
  return `${tenantPrefix}-${namePrefix}`;
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeGstin(value?: string | null) {
  return value?.trim().toUpperCase() || '';
}

async function ensureUniqueEmployeeCode(base: string, excludeUserId?: string) {
  let candidate = base;
  let counter = 1;
  while (counter < 1000) {
    const existing = await prisma.user.findFirst({
      where: {
        employeeCode: candidate,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  return `${base}-${Date.now().toString().slice(-4)}`;
}

export const getBusinessSettings = async (req: Request, res: Response) => {
  try {
    const tenant = await withCache(
      `tenant:${req.tenantId}:business-settings`,
      () =>
        withPrismaRetry(
          () =>
            prisma.tenant.findUnique({
              where: { id: req.tenantId },
              select: {
                id: true,
                businessName: true,
                slug: true,
                email: true,
                phone: true,
                upiId: true,
                hasWaiterService: true,
                gstin: true,
                currencySymbol: true,
                taxRate: true,
                description: true,
                logoUrl: true,
                coverImageUrl: true,
                primaryColor: true,
                accentColor: true,
                businessHours: true,
                isActive: true,
                plan: true,
                trialEndsAt: true,
              },
            }),
          `business-settings:${req.tenantId}`,
        ),
      20,
    );
    if (!tenant) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({
      ...tenant,
      plan: normalizePlan(tenant.plan),
      planLimits: getPlanLimits(tenant.plan),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateBusinessSettings = async (req: Request, res: Response) => {
  try {
    const payload = updateBusinessSettingsSchema.parse(req.body);
    const {
      businessName,
      slug,
      description,
      primaryColor,
      accentColor,
      currencySymbol,
      taxRate,
      logoUrl,
      coverImageUrl,
      email,
      phone,
      upiId,
      hasWaiterService,
      gstin,
      businessHours,
      isActive,
      plan,
      trialEndsAt,
    } = payload;

    const normalizedSlug = slug?.trim().toLowerCase();
    const normalizedGstin = normalizeGstin(gstin);
    const normalizedPlan = plan ? normalizePlan(plan) : undefined;

    if ((normalizedPlan !== undefined || trialEndsAt !== undefined) && req.user?.role !== UserRole.OWNER) {
      return res.status(403).json({
        error: 'Only the workspace owner can change plan or trial settings.',
      });
    }
    
    // Check if slug is taken by another tenant
    if (normalizedSlug) {
      const existing = await prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
      if (existing && existing.id !== req.tenantId) {
        return res.status(400).json({ error: 'Slug already taken' });
      }
    }

    if (normalizedGstin) {
      const existingTenant = await prisma.tenant.findFirst({
        where: {
          gstin: normalizedGstin,
          id: { not: req.tenantId },
        },
        select: { id: true, businessName: true },
      });

      if (existingTenant) {
        return res.status(409).json({
          error: 'GST number already exists. Each workspace must use a unique GST number.',
        });
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        businessName,
        slug: normalizedSlug,
        description,
        primaryColor,
        accentColor,
        currencySymbol,
        taxRate,
        logoUrl,
        coverImageUrl,
        email,
        phone,
        upiId: upiId === undefined ? undefined : upiId?.trim() || null,
        hasWaiterService,
        gstin: gstin === undefined ? undefined : normalizedGstin || null,
        businessHours: businessHours === undefined ? undefined : (businessHours as any),
        isActive,
        plan: normalizedPlan,
        trialEndsAt: normalizedPlan ? null : trialEndsAt, // Remove trial on manual plan change/upgrade
        planStartedAt: normalizedPlan ? new Date() : undefined,
      },
      select: {
        id: true,
        businessName: true,
        slug: true,
        email: true,
        phone: true,
        upiId: true,
        hasWaiterService: true,
        gstin: true,
        currencySymbol: true,
        taxRate: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        primaryColor: true,
        accentColor: true,
        businessHours: true,
        isActive: true,
        plan: true,
        trialEndsAt: true,
      }
    });
    await Promise.all([
      deleteCache(`tenant:${req.tenantId}:business-settings`),
      deleteCache(`tenant:${req.tenantId}:billing`),
      deleteCache(normalizedSlug ? `public_menu_${normalizedSlug}` : `public_menu_${tenant.slug}`),
      deleteCache(`public_menu_${tenant.slug}`),
    ]);
    
    res.json({
      ...tenant,
      plan: normalizePlan(tenant.plan),
      planLimits: getPlanLimits(tenant.plan),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

export const getStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        role: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const payload = createStaffSchema.parse(req.body);
    const { name, password } = payload;
    const role = payload.role;
    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : '';
    const allowedStaffRoles = new Set<UserRole>([
      UserRole.MANAGER,
      UserRole.CASHIER,
      UserRole.KITCHEN,
      UserRole.WAITER,
    ]);

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const tenantLimits = getPlanLimits(tenant.plan);

    if (!allowedStaffRoles.has(normalizedRole as UserRole)) {
      return res.status(400).json({ error: 'Invalid staff role selected' });
    }

    if (normalizedRole === UserRole.WAITER && !tenantLimits.hasWaiterRole) {
      return res.status(403).json({ 
        error: `The ${tenantLimits.name} plan does not support the Waiter role. Please upgrade to CAFÉ or higher.` 
      });
    }

    if (normalizedRole !== UserRole.OWNER && tenantLimits.staff <= 1) {
       return res.status(403).json({ 
        error: `The ${tenantLimits.name} plan is Owner-only. Please upgrade to a higher plan to add staff members.` 
      });
    }

    const requestedLogin = payload.username?.trim() || payload.email?.trim() || '';
    const email = normalizeLoginEmail(requestedLogin, tenant.slug);
    if (!isEmailLike(email)) {
      return res.status(400).json({ error: 'Username format is invalid. Use for example: alex@your-venue.restoflow' });
    }

    const baseEmployeeCode = payload.employeeCode?.trim().toUpperCase() || defaultEmployeeCode(name, tenant.slug);
    const requestedEmployeeCode = baseEmployeeCode;

    const count = await prisma.user.count({ where: { tenantId: req.tenantId } });
    const staffLimits = getPlanLimits(tenant.plan);

    if (count >= staffLimits.staff) {
      return res.status(403).json({ error: `Plan limit reached. Your ${staffLimits.name} plan allows up to ${staffLimits.staff} staff members.` });
    }

    const [existingByEmail, existingByEmployeeCode] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findFirst({ where: { employeeCode: requestedEmployeeCode }, select: { id: true } }),
    ]);

    if (existingByEmail) return res.status(400).json({ error: 'Email already exists' });

    let employeeCode = requestedEmployeeCode;
    if (existingByEmployeeCode) {
      if (payload.employeeCode) {
        return res.status(400).json({ error: 'Employee ID already exists' });
      }
      employeeCode = await ensureUniqueEmployeeCode(requestedEmployeeCode);
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        employeeCode,
        name,
        passwordHash: hashedPassword,
        role: normalizedRole as UserRole,
        tenantId: req.tenantId as string,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        role: true,
        mustChangePassword: true,
        lastLoginAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create staff' });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payload = updateStaffSchema.parse(req.body);
    const allowedStaffRoles = new Set<UserRole>([
      UserRole.MANAGER,
      UserRole.CASHIER,
      UserRole.KITCHEN,
      UserRole.WAITER,
    ]);

    const existingUser = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!existingUser) return res.status(404).json({ error: 'Staff member not found' });
    if (existingUser.role === UserRole.OWNER) {
      return res.status(400).json({ error: 'Owner credentials cannot be edited from staff management.' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { slug: true },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const updateData: Record<string, unknown> = {};

    if (typeof payload.name === 'string' && payload.name.trim()) {
      updateData.name = payload.name.trim();
    }

    if (typeof payload.role === 'string' && payload.role.trim()) {
      const normalizedRole = payload.role.trim().toUpperCase();
      if (!allowedStaffRoles.has(normalizedRole as UserRole)) {
        return res.status(400).json({ error: 'Invalid staff role selected' });
      }

      const currentTenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { plan: true } });
      const planLimits = getPlanLimits(currentTenant?.plan || 'MINI');
      if (normalizedRole === UserRole.WAITER && !planLimits.hasWaiterRole) {
        return res.status(403).json({ 
          error: `The ${planLimits.name} plan does not support the Waiter role.` 
        });
      }

      updateData.role = normalizedRole;
    }

    const requestedLogin = payload.username?.trim() || payload.email?.trim() || '';
    if (requestedLogin) {
      const email = normalizeLoginEmail(requestedLogin, tenant.slug);
      if (!isEmailLike(email)) {
        return res.status(400).json({ error: 'Username format is invalid. Use for example: alex@your-venue.restoflow' });
      }
      const existingByEmail = await prisma.user.findFirst({
        where: { email, id: { not: id } },
        select: { id: true },
      });
      if (existingByEmail) return res.status(400).json({ error: 'Email already exists' });
      updateData.email = email;
    }

    if (payload.employeeCode?.trim()) {
      const employeeCode = payload.employeeCode.trim().toUpperCase();
      const existingByEmployeeCode = await prisma.user.findFirst({
        where: { employeeCode, id: { not: id } },
        select: { id: true },
      });
      if (existingByEmployeeCode) return res.status(400).json({ error: 'Employee ID already exists' });
      updateData.employeeCode = employeeCode;
    }

    if (payload.password?.trim()) {
      updateData.passwordHash = await hashPassword(payload.password);
      updateData.mustChangePassword = true;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        role: true,
        mustChangePassword: true,
        lastLoginAt: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    return res.status(500).json({ error: 'Failed to update staff' });
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
