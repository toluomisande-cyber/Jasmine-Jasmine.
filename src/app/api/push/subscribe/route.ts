import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { loadPushSubscriptions, upsertPushSubscription } from '@/lib/pwa/pushStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const subs = await loadPushSubscriptions();
  return NextResponse.json({ subscribed: subs.length > 0, count: subs.length });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const subscription = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid PushSubscription payload.' }, { status: 400 });
    }

    const total = await upsertPushSubscription(subscription);
    return NextResponse.json({ ok: true, count: total });
  } catch (err: any) {
    console.error('[POST /api/push/subscribe] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save push subscription.' },
      { status: 500 }
    );
  }
}
