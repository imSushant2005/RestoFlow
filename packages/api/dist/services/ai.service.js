"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCartForUpsell = exports.generateItemDescription = void 0;
const genai_1 = require("@google/genai");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
// Instantiate the SDK synchronously if the Token exists
const ai = env_1.env.GEMINI_API_KEY ? new genai_1.GoogleGenAI({ apiKey: env_1.env.GEMINI_API_KEY }) : null;
const generateItemDescription = async (name, category, ingredients) => {
    if (!ai)
        return 'A delicious, hand-crafted dish prepared fresh by our chefs just for you.';
    try {
        const prompt = `You are a world-class culinary copywriter. Write a mouth-watering, premium, consumer-grade description for the following restaurant menu item. Keep it to 2-3 sentences. Do not use quotes.
Dish Name: ${name}
Category: ${category}
Key Ingredients or notes: ${ingredients}`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || '';
    }
    catch (error) {
        logger_1.logger.error({ error, itemName: name }, 'AI Generative Description failed');
        return 'A delicious, hand-crafted dish prepared fresh by our chefs.';
    }
};
exports.generateItemDescription = generateItemDescription;
const analyzeCartForUpsell = async (cartTextSummary, menuTextSummary) => {
    if (!ai)
        return [];
    try {
        const prompt = `You are an intelligent restaurant recommendation engine optimizing for average order value through highly relevant side dish, dessert, or drink pairings.
Based on the current cart contents, suggest exactly 2 or 3 additional items from the available menu that pair perfectly with the order. Return your response as a valid, pure JSON array of strings containing ONLY the exact names of the recommended items from the menu, nothing else.

Current Cart Items:
${cartTextSummary}

Available Menu Items (pick strictly from these names):
${menuTextSummary}

Valid Example Output:
["Garlic Naan", "Mint Mojito"]`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const parsed = JSON.parse(response.text || '[]');
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (error) {
        logger_1.logger.error({ error }, 'AI Generative Upsell Engine failed');
        return [];
    }
};
exports.analyzeCartForUpsell = analyzeCartForUpsell;
//# sourceMappingURL=ai.service.js.map