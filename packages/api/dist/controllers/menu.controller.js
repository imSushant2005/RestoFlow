"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkImportMenu = exports.toggleItemAvailability = exports.bulkUpdateAvailability = exports.reorderMenuItems = exports.updateMenuItem = exports.createMenuItem = exports.getMenuItems = exports.reorderCategories = exports.createCategory = exports.getCategories = void 0;
const prisma_1 = require("../db/prisma");
const socket_1 = require("../socket");
const plans_1 = require("../config/plans");
const cache_service_1 = require("../services/cache.service");
const invalidateMenuCache = async (tenantId) => {
    const t = await prisma_1.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (t)
        await (0, cache_service_1.deleteCache)(`public_menu_${t.slug}`);
};
const getCategories = async (req, res) => {
    try {
        const categories = await prisma_1.prisma.category.findMany({
            where: { tenantId: req.tenantId },
            orderBy: { sortOrder: 'asc' },
        });
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const category = await prisma_1.prisma.category.create({
            data: {
                name,
                description,
                tenantId: req.tenantId,
            },
        });
        await invalidateMenuCache(req.tenantId);
        res.status(201).json(category);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create category' });
    }
};
exports.createCategory = createCategory;
const reorderCategories = async (req, res) => {
    try {
        const { orderIds } = req.body;
        await prisma_1.prisma.$transaction(orderIds.map((id, index) => prisma_1.prisma.category.updateMany({
            where: { id, tenantId: req.tenantId },
            data: { sortOrder: index },
        })));
        await invalidateMenuCache(req.tenantId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to reorder categories' });
    }
};
exports.reorderCategories = reorderCategories;
const getMenuItems = async (req, res) => {
    try {
        const items = await prisma_1.prisma.menuItem.findMany({
            where: { tenantId: req.tenantId },
            orderBy: { sortOrder: 'asc' },
            include: {
                modifierGroups: {
                    include: { modifiers: true }
                }
            }
        });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch items' });
    }
};
exports.getMenuItems = getMenuItems;
const createMenuItem = async (req, res) => {
    try {
        const { name, description, price, categoryId, dietaryTags, imageUrl, images } = req.body;
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const count = await prisma_1.prisma.menuItem.count({ where: { tenantId: req.tenantId } });
        const planLimits = (0, plans_1.getPlanLimits)(tenant.plan);
        if (count >= planLimits.items) {
            return res.status(403).json({ error: `Plan limit reached. Your ${tenant.plan} plan allows up to ${planLimits.items} menu items.` });
        }
        const tags = Array.isArray(dietaryTags) ? dietaryTags : [];
        const isVeg = tags.includes('VEG') || tags.includes('VEGETARIAN');
        const isVegan = tags.includes('VEGAN');
        const isGlutenFree = tags.includes('GLUTEN_FREE') || tags.includes('GF');
        const item = await prisma_1.prisma.menuItem.create({
            data: {
                name,
                description,
                price,
                categoryId,
                isVeg,
                isVegan,
                isGlutenFree,
                images: Array.isArray(images) ? images.filter(Boolean) : imageUrl ? [imageUrl] : [],
                tenantId: req.tenantId,
            },
            include: {
                modifierGroups: {
                    include: { modifiers: true }
                }
            }
        });
        await invalidateMenuCache(req.tenantId);
        res.status(201).json(item);
    }
    catch (error) {
        console.error('Create item err', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
};
exports.createMenuItem = createMenuItem;
const updateMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, imageUrl, images, isAvailable, isPopular, isChefSpecial, isBestSeller, isNew, isVeg, isVegan, isGlutenFree, } = req.body || {};
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (description !== undefined)
            data.description = description;
        if (price !== undefined)
            data.price = Number(price);
        if (isAvailable !== undefined)
            data.isAvailable = !!isAvailable;
        if (isPopular !== undefined)
            data.isPopular = !!isPopular;
        if (isChefSpecial !== undefined)
            data.isChefSpecial = !!isChefSpecial;
        if (isBestSeller !== undefined)
            data.isBestSeller = !!isBestSeller;
        if (isNew !== undefined)
            data.isNew = !!isNew;
        if (isVeg !== undefined)
            data.isVeg = isVeg;
        if (isVegan !== undefined)
            data.isVegan = !!isVegan;
        if (isGlutenFree !== undefined)
            data.isGlutenFree = !!isGlutenFree;
        if (Array.isArray(images))
            data.images = images.filter(Boolean);
        else if (imageUrl !== undefined)
            data.images = imageUrl ? [imageUrl] : [];
        const updated = await prisma_1.prisma.menuItem.updateMany({
            where: { id, tenantId: req.tenantId },
            data,
        });
        if (updated.count === 0)
            return res.status(404).json({ error: 'Item not found' });
        const item = await prisma_1.prisma.menuItem.findUnique({
            where: { id },
            include: { modifierGroups: { include: { modifiers: true } } },
        });
        await invalidateMenuCache(req.tenantId);
        res.json(item);
    }
    catch (error) {
        console.error('updateMenuItem error', error);
        res.status(500).json({ error: 'Failed to update menu item' });
    }
};
exports.updateMenuItem = updateMenuItem;
const reorderMenuItems = async (req, res) => {
    try {
        const { orderIds } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ error: 'orderIds required' });
        }
        await prisma_1.prisma.$transaction(orderIds.map((id, index) => prisma_1.prisma.menuItem.updateMany({
            where: { id, tenantId: req.tenantId },
            data: { sortOrder: index },
        })));
        await invalidateMenuCache(req.tenantId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('reorderMenuItems error', error);
        res.status(500).json({ error: 'Failed to reorder menu items' });
    }
};
exports.reorderMenuItems = reorderMenuItems;
const bulkUpdateAvailability = async (req, res) => {
    try {
        const { itemIds, isAvailable } = req.body;
        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'itemIds required' });
        }
        await prisma_1.prisma.menuItem.updateMany({
            where: { tenantId: req.tenantId, id: { in: itemIds } },
            data: { isAvailable: !!isAvailable },
        });
        for (const id of itemIds) {
            (0, socket_1.getIO)().to(`tenant_${req.tenantId}`).emit('menu:availability_changed', {
                itemId: id,
                isAvailable: !!isAvailable,
            });
        }
        await invalidateMenuCache(req.tenantId);
        res.json({ success: true, itemIds, isAvailable: !!isAvailable });
    }
    catch (error) {
        console.error('bulkUpdateAvailability error', error);
        res.status(500).json({ error: 'Failed to bulk update item availability' });
    }
};
exports.bulkUpdateAvailability = bulkUpdateAvailability;
const toggleItemAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { isAvailable } = req.body;
        const item = await prisma_1.prisma.menuItem.updateMany({
            where: { id, tenantId: req.tenantId },
            data: { isAvailable },
        });
        if (item.count === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        (0, socket_1.getIO)().to(`tenant_${req.tenantId}`).emit('menu:availability_changed', {
            itemId: id,
            isAvailable,
        });
        await invalidateMenuCache(req.tenantId);
        res.json({ success: true, isAvailable });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to toggle availability' });
    }
};
exports.toggleItemAvailability = toggleItemAvailability;
const bulkImportMenu = async (req, res) => {
    try {
        const { categories } = req.body; // { categories: [{ name, items: [{ name, price, description, isVeg }] }] }
        if (!Array.isArray(categories)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }
        const tenantId = req.tenantId;
        await prisma_1.prisma.$transaction(async (tx) => {
            for (const catData of categories) {
                // Find or create category
                let category = await tx.category.findFirst({
                    where: { name: catData.name, tenantId }
                });
                if (!category) {
                    category = await tx.category.create({
                        data: {
                            name: catData.name,
                            tenantId
                        }
                    });
                }
                if (Array.isArray(catData.items)) {
                    for (const itemData of catData.items) {
                        await tx.menuItem.create({
                            data: {
                                name: itemData.name,
                                description: itemData.description || '',
                                price: Number(itemData.price) || 0,
                                isVeg: !!itemData.isVeg,
                                categoryId: category.id,
                                tenantId
                            }
                        });
                    }
                }
            }
        });
        await invalidateMenuCache(tenantId);
        res.json({ success: true, message: 'Menu imported successfully' });
    }
    catch (error) {
        console.error('Bulk import error', error);
        res.status(500).json({ error: 'Failed to import menu' });
    }
};
exports.bulkImportMenu = bulkImportMenu;
//# sourceMappingURL=menu.controller.js.map