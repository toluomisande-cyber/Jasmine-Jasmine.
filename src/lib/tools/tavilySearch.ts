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

/**
 * Search the live web using the Tavily Search API.
 */
export async function tavilySearch(params: {
  query: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  const query = String(params.query || '').trim();

  if (!query) {
    return { query: '', results: [], error: 'Search query cannot be empty.' };
  }

  if (!apiKey) {
    return {
      query,
      results: [],
      error:
        'TAVILY_API_KEY is not configured on the server. Add TAVILY_API_KEY to .env.local to enable live web search.',
    };
  }

  const maxResults = Math.min(Math.max(Number(params.maxResults) || 5, 1), 10);
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
