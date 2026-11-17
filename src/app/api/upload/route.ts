import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_PATTERNS = [
  /^image\/(png|jpeg|jpg|webp|gif)$/i,
  /^application\/pdf$/i,
  /^audio\/(mp3|mpeg|wav|ogg|webm|aac|m4a|mp4)$/i,
  /^video\/mp4$/i,
];

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

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No file provided in form-data payload (field name "file").' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds the 25 MB limit (received ${Math.round(file.size / (1024 * 1024))} MB).` },
        { status: 400 }
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    const isAllowed = ALLOWED_MIME_PATTERNS.some((pattern) => pattern.test(mimeType));

    if (!isAllowed) {
      return NextResponse.json(
        {
          error: `MIME type "${mimeType}" is not supported. Please upload an image, PDF, or audio file.`,
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Upload to Gemini Files API
    const uploadResult = await ai.files.upload({
      file,
      config: {
        mimeType,
      },
    });

    return NextResponse.json({
      success: true,
      fileUri: uploadResult.uri,
      fileName: uploadResult.name,
      mimeType: uploadResult.mimeType || mimeType,
      expiresAt: uploadResult.expirationTime || undefined,
    });
  } catch (err: any) {
    console.error('[POST /api/upload] File upload error:', err);
    return NextResponse.json(
      {
        error:
          err.message ||
          'Failed to upload file to Gemini Files API. Please check your network and API key.',
      },
      { status: 500 }
    );
  }
}

