import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_FISH_VOICE_ID = '5bac2db6b75b400d9a0f2c257a6da812';

function cleanMarkdownForTts(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/```[\s\S]*?```/g, ' I have placed the code snippet on your screen. ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~|#{1,6}\s+|>)/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\|/g, ', ')
    .replace(/^[-:,\s]+$/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function requestFishAudio(params: {
  apiKey: string;
  model: string;
  text: string;
  referenceId: string;
}): Promise<Response> {
  return fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      model: params.model,
    },
    body: JSON.stringify({
      text: params.text,
      reference_id: params.referenceId,
      format: 'mp3',
      mp3_bitrate: 128,
      latency: 'balanced',
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawText = typeof body?.text === 'string' ? body.text : '';
    const cleanedText = cleanMarkdownForTts(rawText).slice(0, 2000);

    if (!cleanedText) {
      return NextResponse.json({ error: 'Missing text for TTS.' }, { status: 400 });
    }

    const fishApiKey = (process.env.FISH_AUDIO_API_KEY || '').trim();
    const hasRealFishKey =
      Boolean(fishApiKey) &&
      fishApiKey !== 'your_newly_regenerated_fish_key_here' &&
      !fishApiKey.startsWith('your_');

    if (!hasRealFishKey) {
      return NextResponse.json(
        { error: 'FISH_AUDIO_API_KEY is not configured.' },
        { status: 501 }
      );
    }

    const referenceId = (process.env.FISH_AUDIO_VOICE_ID || DEFAULT_FISH_VOICE_ID).trim();
    const configuredModel = (process.env.FISH_AUDIO_MODEL || 's1').trim();

    let fishRes = await requestFishAudio({
      apiKey: fishApiKey,
      model: configuredModel,
      text: cleanedText,
      referenceId,
    });

    // If 's1' returns 402 (insufficient paid model credits), automatically retry with Fish Audio's free s2.1-pro-free model
    if (fishRes.status === 402 && configuredModel !== 's2.1-pro-free') {
      fishRes = await requestFishAudio({
        apiKey: fishApiKey,
        model: 's2.1-pro-free',
        text: cleanedText,
        referenceId,
      });
    }

    if (!fishRes.ok) {
      const errText = await fishRes.text().catch(() => '');
      console.warn(`[POST /api/tts] Fish Audio returned ${fishRes.status}:`, errText.slice(0, 240));
      return NextResponse.json(
        { error: `Fish Audio TTS returned ${fishRes.status}` },
        { status: fishRes.status === 401 || fishRes.status === 402 ? 501 : fishRes.status }
      );
    }

    const audioBuffer = Buffer.from(await fishRes.arrayBuffer());
    return new Response(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[POST /api/tts] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to synthesize voice audio.' },
      { status: 500 }
    );
  }
}
