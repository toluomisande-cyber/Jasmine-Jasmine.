import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEYGEN_FREE_MODEL = 'heygen/heygen-voice-1-turbo:free';
const HEYGEN_PAID_MODEL = 'heygen/heygen-voice-1-turbo';
const DEFAULT_HEYGEN_VOICE = 'sabrina';
const DEFAULT_FISH_VOICE_ID = '5bac2db6b75b400d9a0f2c257a6da812';
const DEFAULT_FISH_MODEL = 's2.1-pro-free';
let freeCooldownUntil = 0;

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
    const { text, voice } = await req.json();
    const cleanedText = String(text || '').trim().slice(0, 2000);

    if (!cleanedText) {
      return NextResponse.json({ error: 'Missing text for TTS.' }, { status: 400 });
    }

    // 1. Primary: Fish Audio TTS if FISH_AUDIO_API_KEY is configured with a real key
    const fishApiKey = (process.env.FISH_AUDIO_API_KEY || '').trim();
    const hasRealFishKey =
      Boolean(fishApiKey) &&
      fishApiKey !== 'your_newly_regenerated_fish_key_here' &&
      !fishApiKey.startsWith('your_');

    if (hasRealFishKey) {
      const fishVoiceId = (process.env.FISH_AUDIO_VOICE_ID || DEFAULT_FISH_VOICE_ID).trim();
      const fishModel = (process.env.FISH_AUDIO_MODEL || DEFAULT_FISH_MODEL).trim();

      try {
        const fishRes = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fishApiKey}`,
            model: fishModel,
          },
          body: JSON.stringify({
            text: cleanedText,
            reference_id: fishVoiceId,
            format: 'mp3',
            mp3_bitrate: 128,
          }),
        });

        if (fishRes.ok) {
          const fishBuf = Buffer.from(await fishRes.arrayBuffer());
          return new Response(new Uint8Array(fishBuf), {
            headers: {
              'Content-Type': fishRes.headers.get('content-type') || 'audio/mpeg',
              'Cache-Control': 'no-store',
            },
          });
        } else {
          const fishErr = await fishRes.text().catch(() => '');
          console.warn(
            `[POST /api/tts] Fish Audio (${fishModel}) returned ${fishRes.status}:`,
            fishErr.slice(0, 200)
          );
        }
      } catch (fishFetchErr) {
        console.warn('[POST /api/tts] Fish Audio request failed, falling back to OpenRouter:', fishFetchErr);
      }
    }

    // 2. Fallback: OpenRouter HeyGen TTS
    const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Neither FISH_AUDIO_API_KEY nor OPENROUTER_API_KEY is configured on the server.' },
        { status: 500 }
      );
    }

    const chosenVoice =
      typeof voice === 'string' && voice.trim() ? voice.trim() : DEFAULT_HEYGEN_VOICE;

    const useFreeFirst = Date.now() > freeCooldownUntil;
    const primaryModel = useFreeFirst ? HEYGEN_FREE_MODEL : HEYGEN_PAID_MODEL;

    let res = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Jasmine Assistant',
      },
      body: JSON.stringify({
        model: primaryModel,
        input: cleanedText,
        voice: chosenVoice,
      }),
    });

    if (!res.ok && primaryModel === HEYGEN_FREE_MODEL) {
      freeCooldownUntil = Date.now() + 60_000;
      console.warn(`[POST /api/tts] ${HEYGEN_FREE_MODEL} returned ${res.status}, switching to ${HEYGEN_PAID_MODEL} for 60s...`);
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
