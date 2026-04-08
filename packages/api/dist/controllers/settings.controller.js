"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStaff = exports.updateStaff = exports.createStaff = exports.getStaff = exports.updateBusinessSettings = exports.getBusinessSettings = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const prisma_2 = require("@dineflow/prisma");
const hash_1 = require("../utils/hash");
const zod_1 = require("zod");
const createStaffSchema = zod_1.z
    .object({
    email: zod_1.z.string().trim().optional(),
    username: zod_1.z.string().trim().optional(),
    name: zod_1.z.string().trim().min(1).max(80),
    password: zod_1.z.string().min(6),
    role: zod_1.z.string(),
    employeeCode: zod_1.z
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
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Username is required',
            path: ['username'],
        });
    }
});
const updateStaffSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80).optional(),
    role: zod_1.z.string().optional(),
    email: zod_1.z.string().trim().optional(),
    username: zod_1.z.string().trim().optional(),
    employeeCode: zod_1.z
        .string()
        .trim()
        .min(3)
        .max(40)
        .regex(/^[A-Za-z0-9_-]+$/, 'Employee ID can only include letters, numbers, - and _')
        .optional(),
    password: zod_1.z.string().min(6).optional(),
});
const updateBusinessSettingsSchema = zod_1.z.object({
    businessName: zod_1.z.string().trim().min(1).max(120).optional(),
    slug: zod_1.z.string().trim().min(2).max(120).optional(),
    description: zod_1.z.string().trim().max(500).optional().nullable(),
    primaryColor: zod_1.z.string().trim().max(30).optional(),
    accentColor: zod_1.z.string().trim().max(30).optional(),
    logoUrl: zod_1.z.string().trim().max(500).optional().nullable(),
    coverImageUrl: zod_1.z.string().trim().max(500).optional().nullable(),
    email: zod_1.z.string().trim().email().optional(),
    phone: zod_1.z.string().trim().min(7).max(20).optional(),
    gstin: zod_1.z.string().trim().min(8).max(20).optional(),
    isActive: zod_1.z.boolean().optional(),
});
function sanitizeSegment(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function normalizeLoginEmail(raw, tenantSlug) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed)
        return '';
    const handlePart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
    const handle = sanitizeSegment(handlePart) || 'staff';
    return `${handle}@${tenantSlug}.restoflow`;
}
function defaultEmployeeCode(name, tenantSlug) {
    const tenantPrefix = sanitizeSegment(tenantSlug).slice(0, 4).toUpperCase() || 'REST';
    const namePrefix = sanitizeSegment(name).replace(/-/g, '').slice(0, 6).toUpperCase() || 'STAFF';
    return `${tenantPrefix}-${namePrefix}`;
}
function isEmailLike(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function normalizeGstin(value) {
    return value?.trim().toUpperCase() || '';
}
async function ensureUniqueEmployeeCode(base, excludeUserId) {
    let candidate = base;
    let counter = 1;
    while (counter < 1000) {
        const existing = await prisma_1.prisma.user.findFirst({
            where: {
                employeeCode: candidate,
                ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
            },
            select: { id: true },
        });
        if (!existing)
            return candidate;
        counter += 1;
        candidate = `${base}-${counter}`;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
}
const getBusinessSettings = async (req, res) => {
    try {
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { id: req.tenantId },
            select: {
                id: true,
                businessName: true,
                slug: true,
                email: true,
                phone: true,
                gstin: true,
                taxRate: true,
                description: true,
                logoUrl: true,
                coverImageUrl: true,
                primaryColor: true,
                accentColor: true,
                isActive: true,
            }
        });
        res.json(tenant);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};
exports.getBusinessSettings = getBusinessSettings;
const updateBusinessSettings = async (req, res) => {
    try {
        const payload = updateBusinessSettingsSchema.parse(req.body);
        const { businessName, slug, description, primaryColor, accentColor, logoUrl, coverImageUrl, email, phone, gstin, isActive, } = payload;
        const normalizedSlug = slug?.trim().toLowerCase();
        const normalizedGstin = normalizeGstin(gstin);
        // Check if slug is taken by another tenant
        if (normalizedSlug) {
            const existing = await prisma_1.prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
            if (existing && existing.id !== req.tenantId) {
                return res.status(400).json({ error: 'Slug already taken' });
            }
        }
        if (normalizedGstin) {
            const existingTenant = await prisma_1.prisma.tenant.findFirst({
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
        const tenant = await prisma_1.prisma.tenant.update({
            where: { id: req.tenantId },
            data: {
                businessName,
                slug: normalizedSlug,
                description,
                primaryColor,
                accentColor,
                logoUrl,
                coverImageUrl,
                email,
                phone,
                gstin: gstin === undefined ? undefined : normalizedGstin || null,
                isActive,
            },
            select: {
                id: true,
                businessName: true,
                slug: true,
                email: true,
                phone: true,
                gstin: true,
                taxRate: true,
                description: true,
                logoUrl: true,
                coverImageUrl: true,
                primaryColor: true,
                accentColor: true,
                isActive: true,
            }
        });
        res.json(tenant);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
exports.updateBusinessSettings = updateBusinessSettings;
const getStaff = async (req, res) => {
    try {
        const staff = await prisma_1.prisma.user.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
};
exports.getStaff = getStaff;
const createStaff = async (req, res) => {
    try {
        const payload = createStaffSchema.parse(req.body);
        const { name, password } = payload;
        const role = payload.role;
        const normalizedRole = typeof role === 'string' ? role.toUpperCase() : '';
        const allowedStaffRoles = new Set([
            prisma_2.UserRole.MANAGER,
            prisma_2.UserRole.CASHIER,
            prisma_2.UserRole.KITCHEN,
            prisma_2.UserRole.WAITER,
        ]);
        if (!allowedStaffRoles.has(normalizedRole)) {
            return res.status(400).json({ error: 'Invalid staff role selected' });
        }
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const requestedLogin = payload.username?.trim() || payload.email?.trim() || '';
        const email = normalizeLoginEmail(requestedLogin, tenant.slug);
        if (!isEmailLike(email)) {
            return res.status(400).json({ error: 'Username format is invalid. Use for example: alex@your-venue.restoflow' });
        }
        const baseEmployeeCode = payload.employeeCode?.trim().toUpperCase() || defaultEmployeeCode(name, tenant.slug);
        const requestedEmployeeCode = baseEmployeeCode;
        const count = await prisma_1.prisma.user.count({ where: { tenantId: req.tenantId } });
        const planLimits = (0, plans_1.getPlanLimits)(tenant.plan);
        if (count >= planLimits.staff) {
            return res.status(403).json({ error: `Plan limit reached. Your ${tenant.plan} plan allows up to ${planLimits.staff} staff members.` });
        }
        const [existingByEmail, existingByEmployeeCode] = await Promise.all([
            prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true } }),
            prisma_1.prisma.user.findFirst({ where: { employeeCode: requestedEmployeeCode }, select: { id: true } }),
        ]);
        if (existingByEmail)
            return res.status(400).json({ error: 'Email already exists' });
        let employeeCode = requestedEmployeeCode;
        if (existingByEmployeeCode) {
            if (payload.employeeCode) {
                return res.status(400).json({ error: 'Employee ID already exists' });
            }
            employeeCode = await ensureUniqueEmployeeCode(requestedEmployeeCode);
        }
        const hashedPassword = await (0, hash_1.hashPassword)(password);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                employeeCode,
                name,
                passwordHash: hashedPassword,
                role: normalizedRole,
                tenantId: req.tenantId,
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Failed to create staff' });
    }
};
exports.createStaff = createStaff;
const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = updateStaffSchema.parse(req.body);
        const allowedStaffRoles = new Set([
            prisma_2.UserRole.MANAGER,
            prisma_2.UserRole.CASHIER,
            prisma_2.UserRole.KITCHEN,
            prisma_2.UserRole.WAITER,
        ]);
        const existingUser = await prisma_1.prisma.user.findFirst({
            where: { id, tenantId: req.tenantId },
            select: {
                id: true,
                role: true,
            },
        });
        if (!existingUser)
            return res.status(404).json({ error: 'Staff member not found' });
        if (existingUser.role === prisma_2.UserRole.OWNER) {
            return res.status(400).json({ error: 'Owner credentials cannot be edited from staff management.' });
        }
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { id: req.tenantId },
            select: { slug: true },
        });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const updateData = {};
        if (typeof payload.name === 'string' && payload.name.trim()) {
            updateData.name = payload.name.trim();
        }
        if (typeof payload.role === 'string' && payload.role.trim()) {
            const normalizedRole = payload.role.trim().toUpperCase();
            if (!allowedStaffRoles.has(normalizedRole)) {
                return res.status(400).json({ error: 'Invalid staff role selected' });
            }
            updateData.role = normalizedRole;
        }
        const requestedLogin = payload.username?.trim() || payload.email?.trim() || '';
        if (requestedLogin) {
            const email = normalizeLoginEmail(requestedLogin, tenant.slug);
            if (!isEmailLike(email)) {
                return res.status(400).json({ error: 'Username format is invalid. Use for example: alex@your-venue.restoflow' });
            }
            const existingByEmail = await prisma_1.prisma.user.findFirst({
                where: { email, id: { not: id } },
                select: { id: true },
            });
            if (existingByEmail)
                return res.status(400).json({ error: 'Email already exists' });
            updateData.email = email;
        }
        if (payload.employeeCode?.trim()) {
            const employeeCode = payload.employeeCode.trim().toUpperCase();
            const existingByEmployeeCode = await prisma_1.prisma.user.findFirst({
                where: { employeeCode, id: { not: id } },
                select: { id: true },
            });
            if (existingByEmployeeCode)
                return res.status(400).json({ error: 'Employee ID already exists' });
            updateData.employeeCode = employeeCode;
        }
        if (payload.password?.trim()) {
            updateData.passwordHash = await (0, hash_1.hashPassword)(payload.password);
            updateData.mustChangePassword = true;
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }
        const updated = await prisma_1.prisma.user.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return res.status(500).json({ error: 'Failed to update staff' });
    }
};
exports.updateStaff = updateStaff;
const deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        // Prevent deleting oneself
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        await prisma_1.prisma.user.delete({
            where: { id, tenantId: req.tenantId }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete staff' });
    }
};
exports.deleteStaff = deleteStaff;
//# sourceMappingURL=settings.controller.js.map