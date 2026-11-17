import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { sendPushNotificationToAll } from '@/lib/pwa/pushStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, body, url } = await req.json();
    const result = await sendPushNotificationToAll({
      title: String(title || 'Jasmine'),
      body: String(body || 'Push notifications are working!'),
      url: url ? String(url) : '/',
    });

    if (result.error && result.sent === 0) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/push/send] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to send push notification.' },
      { status: 500 }
    );
  }
}
