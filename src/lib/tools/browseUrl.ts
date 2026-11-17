import * as cheerio from 'cheerio';

export interface BrowseUrlResult {
  title: string;
  url: string;
  content: string;
  error?: string;
}

const MAX_CONTENT_CHARS = 12000;

export async function browseUrl(targetUrl: string): Promise<BrowseUrlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        title: '',
        url: targetUrl,
        content: '',
        error: 'Only HTTP and HTTPS URLs are supported.',
      };
    }

    const res = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; JasmineAssistant/1.0)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        title: '',
        url: parsed.toString(),
        content: '',
        error: `Failed to fetch URL (HTTP ${res.status})`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();

    if (!contentType.includes('html')) {
      return {
        title: parsed.hostname,
        url: parsed.toString(),
        content: raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CONTENT_CHARS),
      };
    }

    const $ = cheerio.load(raw);
    $('script, style, noscript, svg, iframe, nav, footer, header').remove();

    const title = ($('title').first().text() || parsed.hostname).trim();
    const bodyText = ($('main').text() || $('article').text() || $('body').text() || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CONTENT_CHARS);

    return {
      title,
      url: parsed.toString(),
      content: bodyText || 'No readable text content found on this page.',
    };
  } catch (err: any) {
    return {
      title: '',
      url: targetUrl,
      content: '',
      error:
        err?.name === 'AbortError'
          ? 'Timed out after 10 seconds while loading the page.'
          : err?.message || 'Unable to fetch webpage.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
