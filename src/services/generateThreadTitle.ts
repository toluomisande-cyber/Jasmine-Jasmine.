export async function requestThreadTitle(userPrompt: string, assistantReply: string): Promise<string | null> {
  try {
    const res = await fetch('/api/title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userPrompt: userPrompt.slice(0, 1000),
        assistantReply: assistantReply.slice(0, 1000),
      }),
    });

    if (!res.ok) {
      console.warn('[generateThreadTitle] Title request returned status', res.status);
      return null;
    }

    const data = await res.json();
    if (data && typeof data.title === 'string' && data.title.trim()) {
      return data.title.trim().replace(/^["']|["']$/g, '');
    }
    return null;
  } catch (err) {
    console.warn('[generateThreadTitle] Failed to request title:', err);
    return null;
  }
}
