import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is not configured on the server. Please add your key to .env.local.',
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { userPrompt, assistantReply } = body;

    if (!userPrompt || typeof userPrompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid userPrompt in request body.' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction =
      'You are a title generator for chat conversations. Generate a concise, natural, and descriptive title of exactly 3 to 5 words based on the initial user request and reply. Return ONLY the plain text title without quotes, backticks, emojis, or punctuation.';

    const promptText = `User message: ${userPrompt.slice(0, 500)}\nAssistant reply: ${String(
      assistantReply || ''
    ).slice(0, 500)}\n\nTitle:`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: promptText,
      config: {
        systemInstruction,
        maxOutputTokens: 20,
        temperature: 0.3,
      },
    });

    let title = (response.text || '').trim();
    // Clean up quotes, punctuation, newlines
    title = title
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/[.\n\r]+$/, '')
      .trim();

    if (!title || title.length > 50) {
      // Fallback: first 4-5 words of user prompt
      const words = userPrompt.trim().split(/\s+/).slice(0, 4);
      title = words.join(' ');
    }

    return NextResponse.json({ title });
  } catch (err: any) {
    console.error('[POST /api/title] Error generating thread title:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate title.' },
      { status: 500 }
    );
  }
}

