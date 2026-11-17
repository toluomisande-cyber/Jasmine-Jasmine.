import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { browseUrl } from '@/lib/tools/browseUrl';
import { searchGmail, prepareEmail } from '@/lib/tools/gmailTools';
import { tavilySearch } from '@/lib/tools/tavilySearch';
import {
  listCalendarEvents,
  createCalendarEvent,
  searchDriveFiles,
  listTasks,
  createTask,
} from '@/lib/tools/workspaceTools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { name, args = {}, memories = [] } = await req.json();
    const memoryList = Array.isArray(memories)
      ? memories.filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];

    let result: unknown;
    let pendingAction: unknown = undefined;
    let memorySaved: string | undefined = undefined;

    if (name === 'google_search') {
      result = await tavilySearch({
        query: String(args.query || ''),
        maxResults: args.maxResults ? Number(args.maxResults) : 5,
        searchDepth: args.searchDepth === 'advanced' ? 'advanced' : 'basic',
      });
    } else if (name === 'browse_url') {
      result = await browseUrl(String(args.url || ''));
    } else if (name === 'search_gmail') {
      result = await searchGmail(
        {
          query: String(args.query || ''),
          maxResults: args.maxResults ? Number(args.maxResults) : 5,
        },
        session?.accessToken,
        session?.refreshToken
      );
    } else if (name === 'prepare_email') {
      pendingAction = prepareEmail({
        to: String(args.to || ''),
        subject: String(args.subject || ''),
        body: String(args.body || ''),
      });
      result = {
        prepared: true,
        message: 'Email draft created and shown on screen for Approve & Send confirmation.',
      };
    } else if (name === 'save_memory') {
      const fact = String(args.fact || '').trim();
      if (fact) {
        memorySaved = fact;
        result = { saved: true, fact };
      } else {
        result = { saved: false, error: 'Fact cannot be empty.' };
      }
    } else if (name === 'search_memory') {
      const q = String(args.query || '').toLowerCase().trim();
      const matches = memoryList.filter((m) => m.toLowerCase().includes(q));
      result = { count: matches.length, matches };
    } else if (name === 'list_calendar_events') {
      result = await listCalendarEvents(
        {
          timeMin: args.timeMin ? String(args.timeMin) : undefined,
          timeMax: args.timeMax ? String(args.timeMax) : undefined,
          maxResults: args.maxResults ? Number(args.maxResults) : undefined,
        },
        session?.accessToken,
        session?.refreshToken
      );
    } else if (name === 'create_calendar_event') {
      result = await createCalendarEvent(
        {
          summary: String(args.summary || ''),
          startIso: String(args.startIso || ''),
          endIso: String(args.endIso || ''),
          description: args.description ? String(args.description) : undefined,
          location: args.location ? String(args.location) : undefined,
          attendees: Array.isArray(args.attendees) ? args.attendees.map(String) : undefined,
        },
        session?.accessToken,
        session?.refreshToken
      );
    } else if (name === 'search_drive_files') {
      result = await searchDriveFiles(
        {
          query: String(args.query || ''),
          maxResults: args.maxResults ? Number(args.maxResults) : undefined,
        },
        session?.accessToken,
        session?.refreshToken
      );
    } else if (name === 'list_tasks') {
      result = await listTasks(
        {
          maxResults: args.maxResults ? Number(args.maxResults) : undefined,
          showCompleted: Boolean(args.showCompleted),
        },
        session?.accessToken,
        session?.refreshToken
      );
    } else if (name === 'create_task') {
      result = await createTask(
        {
          title: String(args.title || ''),
          notes: args.notes ? String(args.notes) : undefined,
          dueIso: args.dueIso ? String(args.dueIso) : undefined,
        },
        session?.accessToken,
        session?.refreshToken
      );
    } else {
      result = { error: `Unknown tool: ${name}` };
    }

    return NextResponse.json({ result, pendingAction, memorySaved });
  } catch (err: any) {
    console.error('[POST /api/live/tool] Error:', err);
    return NextResponse.json(
      { result: { error: err?.message || 'Tool execution failed.' } },
      { status: 500 }
    );
  }
}
