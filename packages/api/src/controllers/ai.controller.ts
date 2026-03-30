import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { generateItemDescription, analyzeCartForUpsell, extractMenuFromImage } from '../services/ai.service';
import { getCache, setCache } from '../services/cache.service';
import { logger } from '../utils/logger';

export const generateDescription = async (req: Request, res: Response) => {
  try {
    const { name, category, ingredients } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ success: false, error: 'Name and Category required for AI Generative Context' });
    }

    const description = await generateItemDescription(name, category, ingredients || '');
    
    res.json({ success: true, description });
  } catch (error) {
    logger.error({ error }, 'Description Generation Controller Failed');
    res.status(500).json({ success: false, error: 'AI Synthesis Engine Failure' });
  }
};

export const getUpsellRecommendations = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, cartItemIds } = req.body; // e.g., ["cuid1", "cuid2"]

    if (!tenantSlug || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      return res.json({ success: true, recommendations: [] });
    }

    // Hash the cart context to prevent duplicate AI billing for the exact same order structure
    const sortedIds = [...cartItemIds].sort().join(',');
    const cartHash = crypto.createHash('sha256').update(`${tenantSlug}_${sortedIds}`).digest('hex');
    const cacheKey = `ai_upsell_${cartHash}`;

    const cached = await getCache(cacheKey);
    if (cached) return res.json({ success: true, recommendations: cached });

    // Fetch context
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        menuItems: {
          where: { isAvailable: true },
          select: { id: true, name: true, price: true, category: { select: { name: true } } }
        }
      }
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Vendor missing' });

    const cartItemsContext = tenant.menuItems
      .filter(item => cartItemIds.includes(item.id))
      .map(item => `- ${item.name} (${item.category?.name})`)
      .join('\n');

    const availableMenuContext = tenant.menuItems
      .filter(item => !cartItemIds.includes(item.id)) // Don't recommend what they already have
      .map(item => `- ${item.name}`)
      .join('\n');

    if (!cartItemsContext || !availableMenuContext) {
      return res.json({ success: true, recommendations: [] });
    }

    const recommendedNames = await analyzeCartForUpsell(cartItemsContext, availableMenuContext);

    // Map names back to actual MenuItem Objects
    const recommendations = tenant.menuItems.filter(item => recommendedNames.includes(item.name));

    // Cache exact pairing match for 24 hours to deeply cut API costs
    if (recommendations.length > 0) {
      await setCache(cacheKey, recommendations, 24 * 3600);
    }

    res.json({ success: true, recommendations });
  } catch (error) {
    logger.error({ error }, 'Upsell Generation Controller Failed');
    res.status(500).json({ success: false, error: 'AI Recommendation Engine Failure' });
  }
};

export const processMenuImage = async (req: Request, res: Response) => {
  try {
    const { image } = req.body; // base64
    
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const menuJson = await extractMenuFromImage(image);
    
    res.json({ success: true, menu: menuJson });
  } catch (error: any) {
    logger.error({ error }, 'Menu Image Process Controller Failed');
    res.status(500).json({ success: false, error: error.message || 'AI Menu Extraction Failed' });
  }
};
