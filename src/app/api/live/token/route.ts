import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { GoogleGenAI } from '@google/genai';
import { authOptions } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const expireTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const tokenRes = await ai.authTokens.create({
      config: {
        uses: 3,
        expireTime,
      },
    });

    if (!tokenRes?.name) {
      throw new Error('Failed to mint ephemeral Gemini Live token.');
    }

    return NextResponse.json({
      token: tokenRes.name,
      model: 'gemini-2.5-flash-native-audio-latest',
      fallbackModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
      voiceName: 'Aoede',
    });
  } catch (err: any) {
    console.error('[POST /api/live/token] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unable to create live voice session token.' },
      { status: 500 }
    );
  }
}
