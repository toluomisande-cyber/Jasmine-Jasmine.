import { GoogleGenAI } from '@google/genai';

export interface GeneratedImageResult {
  imageUrl?: string;
  prompt: string;
  error?: string;
}

export interface ImageSearchItem {
  url: string;
  description?: string;
}

export interface ImageSearchResult {
  query: string;
  images: ImageSearchItem[];
  error?: string;
}

/**
 * Generate a hyper-realistic or stylized image using Gemini native image generation.
 */
export async function generateImage(params: {
  prompt: string;
}): Promise<GeneratedImageResult> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const prompt = String(params.prompt || '').trim();

  if (!prompt) {
    return { prompt: '', error: 'Image prompt cannot be empty.' };
  }
  if (!apiKey) {
    return { prompt, error: 'GEMINI_API_KEY is not configured on the server.' };
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'gemini-3-pro-image'];

  let lastError = 'Image generation failed.';
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          return {
            imageUrl: `data:${mime};base64,${part.inlineData.data}`,
            prompt,
          };
        }
      }
      lastError = 'Model did not return an image.';
    } catch (err: any) {
      lastError = err?.message || lastError;
      console.warn(`[visualTools] Image model ${model} failed:`, lastError);
    }
  }

  return { prompt, error: lastError };
}

/**
 * Search the live web for high-resolution images via Tavily.
 */
export async function searchImages(params: {
  query: string;
  maxResults?: number;
}): Promise<ImageSearchResult> {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  const query = String(params.query || '').trim();

  if (!query) {
    return { query: '', images: [], error: 'Image search query cannot be empty.' };
  }
  if (!apiKey) {
    return {
      query,
      images: [],
      error: 'TAVILY_API_KEY is not configured in .env.local for web image search.',
    };
  }

  const maxResults = Math.min(Math.max(Number(params.maxResults) || 6, 1), 10);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        include_images: true,
        include_image_descriptions: true,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        query,
        images: [],
        error: `Image search failed (${res.status}): ${errText || res.statusText}`,
      };
    }

    const data = await res.json();
    const rawImages = Array.isArray(data?.images) ? data.images : [];
    const images: ImageSearchItem[] = rawImages
      .map((item: any) => {
        if (typeof item === 'string') {
          return { url: item };
        }
        return {
          url: String(item?.url || ''),
          description: item?.description ? String(item.description) : undefined,
        };
      })
      .filter((img: ImageSearchItem) => img.url.startsWith('http'));

    return { query, images };
  } catch (err: any) {
    return {
      query,
      images: [],
      error: err?.message || 'Image search request failed.',
    };
  }
}
