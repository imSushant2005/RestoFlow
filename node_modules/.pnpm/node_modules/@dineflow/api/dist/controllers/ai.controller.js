"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpsellRecommendations = exports.generateDescription = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../db/prisma");
const ai_service_1 = require("../services/ai.service");
const cache_service_1 = require("../services/cache.service");
const logger_1 = require("../utils/logger");
const generateDescription = async (req, res) => {
    try {
        const { name, category, ingredients } = req.body;
        if (!name || !category) {
            return res.status(400).json({ success: false, error: 'Name and Category required for AI Generative Context' });
        }
        const description = await (0, ai_service_1.generateItemDescription)(name, category, ingredients || '');
        res.json({ success: true, description });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Description Generation Controller Failed');
        res.status(500).json({ success: false, error: 'AI Synthesis Engine Failure' });
    }
};
exports.generateDescription = generateDescription;
const getUpsellRecommendations = async (req, res) => {
    try {
        const { tenantSlug, cartItemIds } = req.body; // e.g., ["cuid1", "cuid2"]
        if (!tenantSlug || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
            return res.json({ success: true, recommendations: [] });
        }
        // Hash the cart context to prevent duplicate AI billing for the exact same order structure
        const sortedIds = [...cartItemIds].sort().join(',');
        const cartHash = crypto_1.default.createHash('sha256').update(`${tenantSlug}_${sortedIds}`).digest('hex');
        const cacheKey = `ai_upsell_${cartHash}`;
        const cached = await (0, cache_service_1.getCache)(cacheKey);
        if (cached)
            return res.json({ success: true, recommendations: cached });
        // Fetch context
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            include: {
                menuItems: {
                    where: { isAvailable: true },
                    select: { id: true, name: true, price: true, category: { select: { name: true } } }
                }
            }
        });
        if (!tenant)
            return res.status(404).json({ success: false, error: 'Vendor missing' });
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
        const recommendedNames = await (0, ai_service_1.analyzeCartForUpsell)(cartItemsContext, availableMenuContext);
        // Map names back to actual MenuItem Objects
        const recommendations = tenant.menuItems.filter(item => recommendedNames.includes(item.name));
        // Cache exact pairing match for 24 hours to deeply cut API costs
        if (recommendations.length > 0) {
            await (0, cache_service_1.setCache)(cacheKey, recommendations, 24 * 3600);
        }
        res.json({ success: true, recommendations });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Upsell Generation Controller Failed');
        res.status(500).json({ success: false, error: 'AI Recommendation Engine Failure' });
    }
};
exports.getUpsellRecommendations = getUpsellRecommendations;
//# sourceMappingURL=ai.controller.js.map