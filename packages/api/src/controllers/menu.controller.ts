import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getIO } from '../socket';
import { PLAN_LIMITS } from '../config/plans';
import { deleteCache } from '../services/cache.service';

const invalidateMenuCache = async (tenantId: string) => {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (t) await deleteCache(`public_menu_${t.slug}`);
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
    const items = await prisma.menuItem.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        modifierGroups: {
          include: { modifiers: true }
        }
      }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

export const createMenuItem = async (req: Request, res: Response) => {
  try {
    const { name, description, price, categoryId, dietaryTags } = req.body;
    
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const count = await prisma.menuItem.count({ where: { tenantId: req.tenantId } });
    const planLimits = PLAN_LIMITS[tenant.plan as keyof typeof PLAN_LIMITS];

    if (planLimits && count >= planLimits.items) {
      return res.status(403).json({ error: `Plan limit reached. Your ${tenant.plan} plan allows up to ${planLimits.items} menu items.` });
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
        categoryId,
        isVeg,
        isVegan,
        isGlutenFree,
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
