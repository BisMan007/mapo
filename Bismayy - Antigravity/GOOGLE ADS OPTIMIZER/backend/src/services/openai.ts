import OpenAI from 'openai';
import { config } from '../config';

// Initialize OpenAI client if valid key is provided
let openaiClient: OpenAI | null = null;
const isDefaultKey = config.OPENAI_API_KEY === 'your_actual_openai_key_here' || !config.OPENAI_API_KEY;

if (!config.MOCK_MODE && !isDefaultKey) {
  openaiClient = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });
}

/**
 * Generates copy headlines and descriptions using GPT models
 */
export async function generateCopyBrainstorm(prompt: string): Promise<string> {
  if (config.MOCK_MODE || !openaiClient) {
    console.log(`[MOCK OPENAI] Brainstorming copy for prompt: "${prompt}"`);
    return JSON.stringify({
      headlines: [
        "Optimize Campaigns Instantly",
        "Stop Wasting Ad Budget",
        "AI Google Ads Copilot",
        "Smart Ads Bidding Assistant",
        "Scale Campaign ROI Today"
      ],
      descriptions: [
        "Uncover campaign leaks and optimization opportunities with a single click.",
        "A premium dashboard to safely manage and audit your Google Ads campaigns.",
        "Set strict bidding thresholds and automate negative keyword discovery."
      ]
    }, null, 2);
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an elite Google Ads Copywriter. Provide a JSON response containing an array of 5 "headlines" (max 30 chars each) and 3 "descriptions" (max 90 chars each) matching the user requirements.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    return response.choices[0].message.content || '{}';
  } catch (error: any) {
    console.error('OpenAI copy generation error:', error?.message);
    throw error;
  }
}

/**
 * Generates an image using OpenAI DALL-E 3
 */
export async function generateOpenAIImage(prompt: string): Promise<string> {
  if (config.MOCK_MODE || !openaiClient) {
    console.log(`[MOCK OPENAI] Generating DALL-E image for prompt: "${prompt}"`);
    // Return a beautiful abstract placeholder image from Unsplash
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop';
  }

  try {
    const response = await openaiClient.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    });

    return response.data?.[0]?.url || '';
  } catch (error: any) {
    console.error('OpenAI image generation error:', error?.message);
    throw error;
  }
}
