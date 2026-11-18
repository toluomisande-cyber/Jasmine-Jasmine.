export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  error?: string;
}

async function wikipediaFallbackSearch(query: string, maxResults: number): Promise<TavilySearchResponse> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=${maxResults}&prop=extracts|info&inprop=url&exintro=1&explaintext=1&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { query, results: [], error: `Wikipedia search failed (${res.status}).` };
    }
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {}) as any[];
    const results: TavilySearchResult[] = pages.map((p) => ({
      title: String(p?.title || 'Wikipedia'),
      url: String(p?.fullurl || `https://en.wikipedia.org/?curid=${p?.pageid || ''}`),
      content: String(p?.extract || '').slice(0, 1200),
    }));
    return {
      query,
      results,
      ...(results.length === 0 ? { error: 'No web results found.' } : {}),
    };
  } catch (err: any) {
    return { query, results: [], error: err?.message || 'Fallback web search failed.' };
  }
}

/**
 * Search the live web using the Tavily Search API (with free Wikipedia fallback if key is unset).
 */
export async function tavilySearch(params: {
  query: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}): Promise<TavilySearchResponse> {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  const query = String(params.query || '').trim();

  if (!query) {
    return { query: '', results: [], error: 'Search query cannot be empty.' };
  }

  const maxResults = Math.min(Math.max(Number(params.maxResults) || 5, 1), 10);

  if (!apiKey) {
    return wikipediaFallbackSearch(query, maxResults);
  }

  const searchDepth = params.searchDepth === 'advanced' ? 'advanced' : 'basic';

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: searchDepth,
        include_answer: true,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        query,
        results: [],
        error: `Tavily search failed (${res.status}): ${errText || res.statusText}`,
      };
    }

    const data = await res.json();
    const results: TavilySearchResult[] = Array.isArray(data?.results)
      ? data.results.map((item: any) => ({
          title: String(item?.title || item?.url || 'Source'),
          url: String(item?.url || ''),
          content: String(item?.content || '').slice(0, 1200),
          score: typeof item?.score === 'number' ? item.score : undefined,
        }))
      : [];

    return {
      query,
      answer: typeof data?.answer === 'string' ? data.answer : undefined,
      results,
    };
  } catch (err: any) {
    return {
      query,
      results: [],
      error: err?.message || 'Tavily web search request failed.',
    };
  }
}
