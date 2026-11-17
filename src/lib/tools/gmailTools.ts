import { google } from 'googleapis';

export interface GmailSearchInput {
  query: string;
  maxResults?: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId?: string | null;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export interface PrepareEmailInput {
  to: string;
  subject: string;
  body: string;
}

export function createGmailClient(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function searchGmail(
  input: GmailSearchInput,
  accessToken?: string,
  refreshToken?: string
): Promise<{ messages?: GmailMessageSummary[]; error?: string }> {
  if (!accessToken) {
    return {
      error:
        'Gmail is not connected. Ask the user to click "Connect Gmail" in the top bar first.',
    };
  }

  try {
    const gmail = createGmailClient(accessToken, refreshToken);
    const maxResults = Math.min(10, Math.max(1, Number(input.maxResults || 5)));

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: input.query || '',
      maxResults,
    });

    const refs = listRes.data.messages || [];
    if (refs.length === 0) {
      return { messages: [] };
    }

    const details = await Promise.all(
      refs.map(async (ref): Promise<GmailMessageSummary | null> => {
        if (!ref.id) return null;
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = msgRes.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: ref.id,
          threadId: msgRes.data.threadId,
          from: getHeader('From'),
          subject: getHeader('Subject') || '(No subject)',
          date: getHeader('Date'),
          snippet: msgRes.data.snippet || '',
        };
      })
    );

    return {
      messages: details.filter((d): d is GmailMessageSummary => d !== null),
    };
  } catch (err: any) {
    console.error('[gmailTools.searchGmail] Error:', err);
    return {
      error: err?.message || 'Failed to search Gmail messages.',
    };
  }
}

export function prepareEmail(input: PrepareEmailInput) {
  return {
    type: 'send_email' as const,
    status: 'pending' as const,
    payload: {
      to: String(input.to || '').trim(),
      subject: String(input.subject || '').trim(),
      body: String(input.body || '').trim(),
    },
  };
}
