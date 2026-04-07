import { env } from '../config/env';
import { logger } from '../utils/logger';

type GeminiClient = {
  models: {
    generateContent: (input: any) => Promise<{ text?: string }>;
  };
};

let aiClientPromise: Promise<GeminiClient | null> | null = null;

async function getAiClient(): Promise<GeminiClient | null> {
  if (!env.GEMINI_API_KEY) return null;

  if (!aiClientPromise) {
    aiClientPromise = import('@google/genai')
      .then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) as unknown as GeminiClient)
      .catch((error) => {
        logger.error({ error }, 'Failed to load Gemini SDK');
        return null;
      });
  }

  return aiClientPromise;
}

export const generateItemDescription = async (name: string, category: string, ingredients: string): Promise<string> => {
  const ai = await getAiClient();
  if (!ai) return 'A delicious, hand-crafted dish prepared fresh by our chefs just for you.';

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
  } catch (error) {
    logger.error({ error, itemName: name }, 'AI Generative Description failed');
    return 'A delicious, hand-crafted dish prepared fresh by our chefs.';
  }
};

export const analyzeCartForUpsell = async (cartTextSummary: string, menuTextSummary: string): Promise<string[]> => {
  const ai = await getAiClient();
  if (!ai) return [];

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
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error({ error }, 'AI Generative Upsell Engine failed');
    return [];
  }
};

export const extractMenuFromImage = async (base64Image: string): Promise<any> => {
  const ai = await getAiClient();
  if (!ai) throw new Error('AI Engine not initialized. GEMINI_API_KEY missing.');

  try {
    const prompt = `You are a high-accuracy restaurant menu digitizer. Extract all categories and menu items from this image and return them as a valid, strictly structured JSON object.
    
The JSON must follow this exact structure:
{
  "categories": [
    {
      "name": "Category Name (e.g. Starters, Main Course)",
      "items": [
        {
          "name": "Dish Name",
          "description": "Short description if available",
          "price": 299,
          "isVeg": true/false
        }
      ]
    }
  ]
}

- Prices must be plain numbers (do not include currency symbols).
- If currency is not clear, assume INR.
- If description is missing, keep it an empty string.
- Identify "Veg" vs "Non-Veg" from icons or names if possible.
- Group items logically by their physical sections on the menu.
- Return ONLY the raw JSON object. No Markdown. No comments.`;

    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image.split(',')[1] || base64Image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    return JSON.parse(result.text || '{}');
  } catch (error) {
    logger.error({ error }, 'AI Menu Extraction failed');
    throw error;
  }
};
