import { Type, type FunctionDeclaration } from '@google/genai';

export const LIVE_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'google_search',
    description:
      'Search the live web using Tavily for up-to-date information, news, facts, weather, prices, scores, or anything not in memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The web search query.' },
        maxResults: { type: Type.NUMBER, description: 'Maximum number of results (1 to 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'browse_url',
    description: 'Fetch and read the main text content of a specific web page URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Full HTTP or HTTPS URL.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_gmail',
    description: "Search the user's Gmail inbox using Gmail search syntax.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Gmail search query string.' },
        maxResults: { type: Type.NUMBER, description: 'Maximum messages (1 to 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'prepare_email',
    description:
      'Prepare an email draft for the user to review and tap Approve & Send on screen.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address.' },
        subject: { type: Type.STRING, description: 'Email subject line.' },
        body: { type: Type.STRING, description: 'Plain text email body.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'save_memory',
    description:
      'Save a personal fact, preference, name, goal, or detail the user shares about themselves for future sessions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: { type: Type.STRING, description: 'Concise fact to remember.' },
      },
      required: ['fact'],
    },
  },
  {
    name: 'search_memory',
    description: 'Search saved personal memories about the user by keyword.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Keyword to search in memory.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_calendar_events',
    description: "List upcoming events from the user's primary Google Calendar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        timeMin: { type: Type.STRING, description: 'Optional ISO-8601 start timestamp.' },
        timeMax: { type: Type.STRING, description: 'Optional ISO-8601 end timestamp.' },
        maxResults: { type: Type.NUMBER, description: 'Maximum events (1 to 25).' },
      },
    },
  },
  {
    name: 'create_calendar_event',
    description: "Create an event on the user's primary Google Calendar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Event title.' },
        startIso: { type: Type.STRING, description: 'ISO-8601 start date-time.' },
        endIso: { type: Type.STRING, description: 'ISO-8601 end date-time.' },
        description: { type: Type.STRING, description: 'Optional notes.' },
        location: { type: Type.STRING, description: 'Optional location.' },
      },
      required: ['summary', 'startIso', 'endIso'],
    },
  },
  {
    name: 'search_drive_files',
    description: "Search files and Google Docs in the user's Google Drive.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search keyword or file name.' },
        maxResults: { type: Type.NUMBER, description: 'Maximum files (1 to 20).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_tasks',
    description: "List items from the user's Google Tasks to-do list.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        maxResults: { type: Type.NUMBER, description: 'Maximum tasks.' },
        showCompleted: { type: Type.BOOLEAN, description: 'Include completed tasks.' },
      },
    },
  },
  {
    name: 'create_task',
    description: "Add a new task to the user's Google Tasks to-do list.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task title.' },
        notes: { type: Type.STRING, description: 'Optional notes.' },
        dueIso: { type: Type.STRING, description: 'Optional RFC 3339 due date.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'schedule_or_send_notification',
    description: "Send a native Web Push notification to the user's installed Jasmine PWA / browser.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Notification title.' },
        body: { type: Type.STRING, description: 'Notification message body.' },
        url: { type: Type.STRING, description: 'Optional relative URL.' },
      },
      required: ['title', 'body'],
    },
  },
];

export function getLiveToolLabel(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'google_search':
      return `Searching the web for "${String(args.query || '')}"`;
    case 'browse_url':
      return `Reading ${String(args.url || 'webpage')}`;
    case 'search_gmail':
      return `Checking Gmail for "${String(args.query || '')}"`;
    case 'prepare_email':
      return `Drafting email to ${String(args.to || '')}`;
    case 'save_memory':
      return 'Saving to personal memory';
    case 'search_memory':
      return 'Checking personal memory';
    case 'list_calendar_events':
      return 'Checking Google Calendar';
    case 'create_calendar_event':
      return `Scheduling "${String(args.summary || 'event')}"`;
    case 'search_drive_files':
      return `Searching Google Drive for "${String(args.query || '')}"`;
    case 'list_tasks':
      return 'Checking Google Tasks';
    case 'create_task':
      return `Adding task "${String(args.title || '')}"`;
    default:
      return 'Running tool';
  }
}
