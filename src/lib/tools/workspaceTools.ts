import { google } from 'googleapis';

function createGoogleAuth(accessToken?: string, refreshToken?: string) {
  if (!accessToken) {
    throw new Error(
      'Google account is not connected. Ask the user to click "Connect Google" in the sidebar.'
    );
  }
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return auth;
}

function handleGoogleError(err: any, serviceLabel: string) {
  const status = err?.code || err?.response?.status;
  if (status === 401 || status === 403) {
    return {
      error: `${serviceLabel} permission missing or expired. Please sign out and reconnect Google in the sidebar to grant Calendar, Drive, and Tasks access.`,
    };
  }
  return { error: err?.message || `Failed to access ${serviceLabel}.` };
}

export async function listCalendarEvents(
  params: { timeMin?: string; timeMax?: string; maxResults?: number },
  accessToken?: string,
  refreshToken?: string
) {
  try {
    const auth = createGoogleAuth(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const timeMin = params.timeMin || now.toISOString();
    const defaultMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = params.timeMax || defaultMax;
    const maxResults = Math.min(Math.max(Number(params.maxResults) || 10, 1), 25);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (res.data.items || []).map((ev) => ({
      id: ev.id || '',
      summary: ev.summary || '(No title)',
      start: ev.start?.dateTime || ev.start?.date || '',
      end: ev.end?.dateTime || ev.end?.date || '',
      location: ev.location || '',
      htmlLink: ev.htmlLink || '',
      attendees: (ev.attendees || []).map((a) => a.email).filter(Boolean),
    }));

    return { count: events.length, events };
  } catch (err: any) {
    return handleGoogleError(err, 'Google Calendar');
  }
}

export async function createCalendarEvent(
  params: {
    summary: string;
    startIso: string;
    endIso: string;
    description?: string;
    location?: string;
    attendees?: string[];
  },
  accessToken?: string,
  refreshToken?: string
) {
  try {
    const auth = createGoogleAuth(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: params.summary,
        description: params.description || undefined,
        location: params.location || undefined,
        start: { dateTime: params.startIso },
        end: { dateTime: params.endIso },
        attendees: Array.isArray(params.attendees)
          ? params.attendees.filter(Boolean).map((email) => ({ email }))
          : undefined,
      },
    });

    return {
      created: true,
      id: res.data.id || '',
      summary: res.data.summary || params.summary,
      start: res.data.start?.dateTime || params.startIso,
      htmlLink: res.data.htmlLink || '',
    };
  } catch (err: any) {
    return handleGoogleError(err, 'Google Calendar');
  }
}

export async function searchDriveFiles(
  params: { query: string; maxResults?: number },
  accessToken?: string,
  refreshToken?: string
) {
  try {
    const auth = createGoogleAuth(accessToken, refreshToken);
    const drive = google.drive({ version: 'v3', auth });

    const cleanQuery = String(params.query || '').replace(/'/g, "\\'").trim();
    const maxResults = Math.min(Math.max(Number(params.maxResults) || 8, 1), 20);

    const q = cleanQuery
      ? `trashed = false and (name contains '${cleanQuery}' or fullText contains '${cleanQuery}')`
      : 'trashed = false';

    const res = await drive.files.list({
      q,
      pageSize: maxResults,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
      orderBy: 'modifiedTime desc',
    });

    const files = (res.data.files || []).map((f) => ({
      id: f.id || '',
      name: f.name || 'Untitled',
      mimeType: f.mimeType || '',
      modifiedTime: f.modifiedTime || '',
      webViewLink: f.webViewLink || '',
    }));

    return { count: files.length, files };
  } catch (err: any) {
    return handleGoogleError(err, 'Google Drive');
  }
}

export async function listTasks(
  params: { maxResults?: number; showCompleted?: boolean },
  accessToken?: string,
  refreshToken?: string
) {
  try {
    const auth = createGoogleAuth(accessToken, refreshToken);
    const tasksApi = google.tasks({ version: 'v1', auth });

    const maxResults = Math.min(Math.max(Number(params.maxResults) || 15, 1), 30);
    const res = await tasksApi.tasks.list({
      tasklist: '@default',
      maxResults,
      showCompleted: Boolean(params.showCompleted),
      showHidden: false,
    });

    const tasks = (res.data.items || []).map((t) => ({
      id: t.id || '',
      title: t.title || '',
      notes: t.notes || '',
      due: t.due || '',
      status: t.status || 'needsAction',
    }));

    return { count: tasks.length, tasks };
  } catch (err: any) {
    return handleGoogleError(err, 'Google Tasks');
  }
}

export async function createTask(
  params: { title: string; notes?: string; dueIso?: string },
  accessToken?: string,
  refreshToken?: string
) {
  try {
    const auth = createGoogleAuth(accessToken, refreshToken);
    const tasksApi = google.tasks({ version: 'v1', auth });

    const res = await tasksApi.tasks.insert({
      tasklist: '@default',
      requestBody: {
        title: params.title,
        notes: params.notes || undefined,
        due: params.dueIso || undefined,
      },
    });

    return {
      created: true,
      id: res.data.id || '',
      title: res.data.title || params.title,
      due: res.data.due || '',
    };
  } catch (err: any) {
    return handleGoogleError(err, 'Google Tasks');
  }
}
