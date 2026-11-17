import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEYGEN_FREE_MODEL = 'heygen/heygen-voice-1-turbo:free';
const HEYGEN_PAID_MODEL = 'heygen/heygen-voice-1-turbo';
const DEFAULT_HEYGEN_VOICE = 'sabrina';

function wrapPcmInWavHeader(
  pcmBuffer: Buffer,
  sampleRate = 44100,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const { text, voice } = await req.json();
    const cleanedText = String(text || '').trim().slice(0, 2000);

    if (!cleanedText) {
      return NextResponse.json({ error: 'Missing text for TTS.' }, { status: 400 });
    }

    const chosenVoice =
      typeof voice === 'string' && voice.trim() ? voice.trim() : DEFAULT_HEYGEN_VOICE;

    let res = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Jasmine Assistant',
      },
      body: JSON.stringify({
        model: HEYGEN_FREE_MODEL,
        input: cleanedText,
        voice: chosenVoice,
      }),
    });

    if (!res.ok) {
      console.warn(`[POST /api/tts] ${HEYGEN_FREE_MODEL} returned ${res.status}, retrying ${HEYGEN_PAID_MODEL}...`);
      res = await fetch('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'Jasmine Assistant',
        },
        body: JSON.stringify({
          model: HEYGEN_PAID_MODEL,
          input: cleanedText,
          voice: chosenVoice,
        }),
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[POST /api/tts] OpenRouter HeyGen failed (${res.status}):`, errText.slice(0, 200));
      return NextResponse.json(
        { error: `HeyGen TTS returned ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const arrayBuf = await res.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuf);

    if (contentType.includes('audio/pcm') || !contentType.includes('audio/')) {
      const rateMatch = contentType.match(/rate=(\d+)/);
      const chMatch = contentType.match(/channels=(\d+)/);
      const sampleRate = rateMatch ? Number(rateMatch[1]) : 44100;
      const channels = chMatch ? Number(chMatch[1]) : 1;

      const wavBuffer = wrapPcmInWavHeader(rawBuffer, sampleRate, channels, 16);
      return new Response(new Uint8Array(wavBuffer), {
        headers: {
          'Content-Type': 'audio/wav',
          'Cache-Control': 'no-store',
        },
      });
    }

    return new Response(new Uint8Array(rawBuffer), {
      headers: {
        'Content-Type': contentType,
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
