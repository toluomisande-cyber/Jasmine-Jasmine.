import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { createGmailClient } from '@/lib/tools/gmailTools';

export const runtime = 'nodejs';

function encodeBase64Url(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Please connect your Gmail account before sending an email.' },
        { status: 401 }
      );
    }

    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and body.' },
        { status: 400 }
      );
    }

    const rawLines = [
      `To: ${String(to).trim()}`,
      `Subject: ${String(subject).trim()}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      String(body),
    ];
    const rawMessage = encodeBase64Url(rawLines.join('\r\n'));

    const gmail = createGmailClient(session.accessToken, session.refreshToken);
    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: sent.data.id,
      threadId: sent.data.threadId,
    });
  } catch (err: any) {
    console.error('[POST /api/gmail/send] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to send email via Gmail.' },
      { status: 500 }
    );
  }
}
