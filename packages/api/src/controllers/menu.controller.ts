import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getIO } from '../socket';
import { getPlanLimits, normalizePlan } from '../config/plans';
import { deleteCache, withCache } from '../services/cache.service';
import { cacheKeys } from '../utils/cache-keys';

const invalidateMenuCache = async (tenantId: string) => {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  await Promise.all([
    t ? deleteCache(cacheKeys.publicMenu(t.slug)) : Promise.resolve(),
    deleteCache(cacheKeys.dashboardMenuItemsPattern(tenantId)),
  ]);
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.create({
      data: {
        name,
        description,
        tenantId: req.tenantId!,
      },
    });
    
    await invalidateMenuCache(req.tenantId!);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const reorderCategories = async (req: Request, res: Response) => {
  try {
    const { orderIds } = req.body as { orderIds: string[] };
    
    await prisma.$transaction(
      orderIds.map((id, index) => 
        prisma.category.updateMany({
          where: { id, tenantId: req.tenantId },
          data: { sortOrder: index },
        })
      )
    );

    await invalidateMenuCache(req.tenantId!);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
};

export const getMenuItems = async (req: Request, res: Response) => {
  try {
    const categoryId =
      typeof req.query.categoryId === 'string' && req.query.categoryId.trim().length > 0
        ? req.query.categoryId.trim()
        : null;
    const includeModifiers = String(req.query.includeModifiers || '').toLowerCase() === 'true';
    const whereClause = {
      tenantId: req.tenantId,
      ...(categoryId ? { categoryId } : {}),
    };
    const cacheKey = cacheKeys.dashboardMenuItems(
      req.tenantId!,
      categoryId || 'all',
      includeModifiers ? 'full' : 'list',
    );

    const items = await withCache(cacheKey, () => {
      if (includeModifiers) {
        return prisma.menuItem.findMany({
          where: whereClause,
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroups: {
              include: { modifiers: true },
            },
          },
        });
      }

      return prisma.menuItem.findMany({
        where: whereClause,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          tenantId: true,
          categoryId: true,
          name: true,
          description: true,
          price: true,
          compareAtPrice: true,
          images: true,
          isAvailable: true,
          isPopular: true,
          isChefSpecial: true,
          isBestSeller: true,
          isNew: true,
          isVeg: true,
          isVegan: true,
          isGlutenFree: true,
          spiceLevel: true,
          allergens: true,
          calories: true,
          prepTimeMinutes: true,
          sortOrder: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }, 20);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

export const createMenuItem = async (req: Request, res: Response) => {
  try {
    const { name, description, price, categoryId, dietaryTags, imageUrl, images } = req.body;
    
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: req.tenantId,
      },
      select: { id: true },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found for this tenant' });
    }

    const count = await prisma.menuItem.count({ where: { tenantId: req.tenantId } });
    const planLimits = getPlanLimits(tenant.plan);

    if (count >= planLimits.items) {
      return res.status(403).json({ error: `Plan limit reached. Your ${normalizePlan(tenant.plan)} plan allows up to ${planLimits.items} menu items.` });
    }

    const tags = Array.isArray(dietaryTags) ? dietaryTags : [];
    const isVeg = tags.includes('VEG') || tags.includes('VEGETARIAN');
    const isVegan = tags.includes('VEGAN');
    const isGlutenFree = tags.includes('GLUTEN_FREE') || tags.includes('GF');

    const item = await prisma.menuItem.create({
      data: {
        name,
        description,
        price,
        categoryId: category.id,
        isVeg,
        isVegan,
        isGlutenFree,
        images: Array.isArray(images) ? images.filter(Boolean) : imageUrl ? [imageUrl] : [],
        tenantId: req.tenantId!,
      },
      include: {
        modifierGroups: {
          include: { modifiers: true }
        }
      }
    });

    await invalidateMenuCache(req.tenantId!);
    res.status(201).json(item);
  } catch (error) {
    console.error('Create item err', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
};

export const updateMenuItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      imageUrl,
      images,
      isAvailable,
      isPopular,
      isChefSpecial,
      isBestSeller,
      isNew,
      isVeg,
      isVegan,
      isGlutenFree,
    } = req.body || {};

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = Number(price);
    if (isAvailable !== undefined) data.isAvailable = !!isAvailable;
    if (isPopular !== undefined) data.isPopular = !!isPopular;
    if (isChefSpecial !== undefined) data.isChefSpecial = !!isChefSpecial;
    if (isBestSeller !== undefined) data.isBestSeller = !!isBestSeller;
    if (isNew !== undefined) data.isNew = !!isNew;
    if (isVeg !== undefined) data.isVeg = isVeg;
    if (isVegan !== undefined) data.isVegan = !!isVegan;
    if (isGlutenFree !== undefined) data.isGlutenFree = !!isGlutenFree;
    if (Array.isArray(images)) data.images = images.filter(Boolean);
    else if (imageUrl !== undefined) data.images = imageUrl ? [imageUrl] : [];

    const updated = await prisma.menuItem.updateMany({
      where: { id, tenantId: req.tenantId },
      data,
    });
    if (updated.count === 0) return res.status(404).json({ error: 'Item not found' });

    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: { modifierGroups: { include: { modifiers: true } } },
    });

    await invalidateMenuCache(req.tenantId!);
    res.json(item);
  } catch (error) {
    console.error('updateMenuItem error', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
};

export const reorderMenuItems = async (req: Request, res: Response) => {
  try {
    const { orderIds } = req.body as { orderIds: string[] };
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds required' });
    }

    await prisma.$transaction(
      orderIds.map((id, index) =>
        prisma.menuItem.updateMany({
          where: { id, tenantId: req.tenantId },
          data: { sortOrder: index },
        })
      )
    );

    await invalidateMenuCache(req.tenantId!);
    res.json({ success: true });
  } catch (error) {
    console.error('reorderMenuItems error', error);
    res.status(500).json({ error: 'Failed to reorder menu items' });
  }
};

export const bulkUpdateAvailability = async (req: Request, res: Response) => {
  try {
    const { itemIds, isAvailable } = req.body as { itemIds: string[]; isAvailable: boolean };
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds required' });
    }

    await prisma.menuItem.updateMany({
      where: { tenantId: req.tenantId, id: { in: itemIds } },
      data: { isAvailable: !!isAvailable },
    });

    for (const id of itemIds) {
      getIO().to(`tenant_${req.tenantId}`).emit('menu:availability_changed', {
        itemId: id,
        isAvailable: !!isAvailable,
      });
    }

    await invalidateMenuCache(req.tenantId!);
    res.json({ success: true, itemIds, isAvailable: !!isAvailable });
  } catch (error) {
    console.error('bulkUpdateAvailability error', error);
    res.status(500).json({ error: 'Failed to bulk update item availability' });
  }
};

export const toggleItemAvailability = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const item = await prisma.menuItem.updateMany({
      where: { id, tenantId: req.tenantId },
      data: { isAvailable },
    });

    if (item.count === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    getIO().to(`tenant_${req.tenantId}`).emit('menu:availability_changed', {
      itemId: id,
      isAvailable,
    });

    await invalidateMenuCache(req.tenantId!);
    res.json({ success: true, isAvailable });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
};

export const bulkImportMenu = async (req: Request, res: Response) => {
  try {
    const { categories } = req.body; // { categories: [{ name, items: [{ name, price, description, isVeg }] }] }
    
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    const tenantId = req.tenantId!;

    await prisma.$transaction(async (tx) => {
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
  } catch (error) {
    console.error('Bulk import error', error);
    res.status(500).json({ error: 'Failed to import menu' });
  }
};
