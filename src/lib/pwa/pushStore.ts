import fs from 'fs/promises';
import path from 'path';
import * as webpush from 'web-push';
import type { PushSubscription } from 'web-push';

const DATA_DIR = path.join(process.cwd(), '.data');
const SUBS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');

// In-memory fallback for serverless environments with read-only filesystems
let memorySubscriptions: PushSubscription[] = [];

export async function loadPushSubscriptions(): Promise<PushSubscription[]> {
  try {
    const raw = await fs.readFile(SUBS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memorySubscriptions = parsed;
      return parsed;
    }
  } catch {
    // File doesn't exist yet or read-only FS
  }
  return memorySubscriptions;
}

export async function savePushSubscriptions(subs: PushSubscription[]): Promise<void> {
  memorySubscriptions = subs;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
  } catch {
    // Ignore read-only filesystem errors (e.g. serverless runtime)
  }
}

export async function upsertPushSubscription(sub: PushSubscription): Promise<number> {
  const existing = await loadPushSubscriptions();
  const filtered = existing.filter((s) => s.endpoint !== sub.endpoint);
  const next = [...filtered, sub];
  await savePushSubscriptions(next);
  return next.length;
}

export async function sendPushNotificationToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<{ sent: number; failed: number; pruned: number; error?: string }> {
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim();

  if (!publicKey || !privateKey) {
    return {
      sent: 0,
      failed: 0,
      pruned: 0,
      error: 'VAPID keys are not configured on the server.',
    };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const subs = await loadPushSubscriptions();
  if (subs.length === 0) {
    return { sent: 0, failed: 0, pruned: 0, error: 'No active push subscriptions found.' };
  }

  const message = JSON.stringify({
    title: payload.title || 'Jasmine',
    body: payload.body || 'You have a new notification.',
    url: payload.url || '/',
  });

  let sent = 0;
  let failed = 0;
  const expiredEndpoints = new Set<string>();

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, message);
        sent += 1;
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          expiredEndpoints.add(sub.endpoint);
        } else {
          failed += 1;
          console.warn('[pushStore] Failed to deliver push:', err?.message || statusCode);
        }
      }
    })
  );

  if (expiredEndpoints.size > 0) {
    const remaining = subs.filter((s) => !expiredEndpoints.has(s.endpoint));
    await savePushSubscriptions(remaining);
  }

  return { sent, failed, pruned: expiredEndpoints.size };
}
