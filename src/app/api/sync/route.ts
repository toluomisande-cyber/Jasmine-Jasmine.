import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Pool } from 'pg';
import { authOptions } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensureSchema(db: Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS jasmine_user_state (
      user_email TEXT PRIMARY KEY,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function GET() {
  const db = getPool();
  if (!db) {
    return NextResponse.json({ configured: false, state: null });
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ configured: true, authenticated: false, state: null });
  }

  try {
    await ensureSchema(db);
    const result = await db.query(
      'SELECT state, updated_at FROM jasmine_user_state WHERE user_email = $1',
      [email]
    );
    const row = result.rows[0];
    return NextResponse.json({
      configured: true,
      authenticated: true,
      state: row?.state || null,
      updatedAt: row?.updated_at || null,
    });
  } catch (err: any) {
    console.error('[GET /api/sync] DB error:', err);
    return NextResponse.json({ error: err?.message || 'Database read failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = getPool();
  if (!db) {
    return NextResponse.json({ configured: false, synced: false });
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    await ensureSchema(db);
    await db.query(
      `INSERT INTO jasmine_user_state (user_email, state, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_email)
       DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
      [email, JSON.stringify(body || {})]
    );
    return NextResponse.json({ configured: true, synced: true });
  } catch (err: any) {
    console.error('[POST /api/sync] DB error:', err);
    return NextResponse.json({ error: err?.message || 'Database write failed' }, { status: 500 });
  }
}
