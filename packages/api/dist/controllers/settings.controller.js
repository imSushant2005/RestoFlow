"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStaff = exports.createStaff = exports.getStaff = exports.updateBusinessSettings = exports.getBusinessSettings = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const hash_1 = require("../utils/hash");
const getBusinessSettings = async (req, res) => {
    try {
        const tenant = await prisma_1.prisma.tenant.findUnique({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};
exports.getBusinessSettings = getBusinessSettings;
const updateBusinessSettings = async (req, res) => {
    try {
        const { businessName, slug, description, primaryColor, accentColor, logoUrl, coverImageUrl, isActive, } = req.body;
        // Check if slug is taken by another tenant
        if (slug) {
            const existing = await prisma_1.prisma.tenant.findUnique({ where: { slug } });
            if (existing && existing.id !== req.tenantId) {
                return res.status(400).json({ error: 'Slug already taken' });
            }
        }
        const tenant = await prisma_1.prisma.tenant.update({
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
            select: { id: true, name: true, email: true, role: true, createdAt: true }
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
        const { email, name, password, role } = req.body;
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const count = await prisma_1.prisma.user.count({ where: { tenantId: req.tenantId } });
        const planLimits = plans_1.PLAN_LIMITS[tenant.plan];
        if (planLimits && count >= planLimits.staff) {
            return res.status(403).json({ error: `Plan limit reached. Your ${tenant.plan} plan allows up to ${planLimits.staff} staff members.` });
        }
        const existing = await prisma_1.prisma.user.findFirst({ where: { email, tenantId: req.tenantId } });
        if (existing)
            return res.status(400).json({ error: 'Email already exists' });
        const hashedPassword = await (0, hash_1.hashPassword)(password);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                name,
                passwordHash: hashedPassword,
                role: role,
                tenantId: req.tenantId
            },
            select: { id: true, name: true, email: true, role: true }
        });
        res.status(201).json(user);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create staff' });
    }
};
exports.createStaff = createStaff;
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