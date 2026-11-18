import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from '@google/genai';
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
import { sendPushNotificationToAll } from '@/lib/pwa/pushStore';
import { generateImage, searchImages } from '@/lib/tools/visualTools';
import { loadWikiNotes, upsertWikiNote, queryWikiNotes } from '@/lib/tools/wikiMemory';
import type { GroundingSource, UserProfile } from '@/types/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TOOL_ITERATIONS = 5;

const MODEL_ALIAS: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-4-hydrogen',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
};

const FALLBACK_CHAIN: Record<string, string[]> = {
  'gemini-3.5-flash-lite': ['gemini-3.8-flash', 'gemini-4-hydrogen'],
  'gemini-4-hydrogen': ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
  'gemini-3.8-flash': ['gemini-3.5-flash-lite', 'gemini-4-hydrogen'],
};

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'google_search',
    description:
      'Search the live web using Tavily for up-to-date information, news, facts, weather, prices, scores, or anything not in memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The web search query.',
        },
        maxResults: {
          type: Type.NUMBER,
          description: 'Maximum number of search results to return (1 to 10, default 5).',
        },
        searchDepth: {
          type: Type.STRING,
          description: 'Search depth: "basic" for fast answers or "advanced" for deeper research.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'browse_url',
    description:
      'Fetch and read the main text content of a specific web page URL. Use this when the user provides a URL or wants details from a specific page.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'The full HTTP or HTTPS URL to fetch and read.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_gmail',
    description:
      "Search the authenticated user's Gmail inbox using Gmail search syntax (e.g. 'is:unread', 'from:alice', 'subject:invoice').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Gmail search query string.',
        },
        maxResults: {
          type: Type.NUMBER,
          description: 'Maximum number of messages to return (1 to 10).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_memory',
    description:
      'Save a personal fact, preference, name, project, decision, goal, or important detail the user shares about themselves so you remember it in future conversations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: {
          type: Type.STRING,
          description:
            'A concise, clear statement of the fact to remember (e.g. "User\'s name is Alex", "Prefers concise replies", "Building Jasmine AI on Next.js").',
        },
        category: {
          type: Type.STRING,
          description:
            'Optional category tag: "preference", "project", "decision", "contact", "goal", or "fact".',
        },
      },
      required: ['fact'],
    },
  },
  {
    name: 'manage_wiki_note',
    description:
      'Chief-of-Staff persistent wiki notebook for tracking ongoing projects, architectural decisions, study topics, and structured reference notes across sessions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'Action to perform: "upsert" to create/update a note, "search" to find notes, or "list" to view the wiki index.',
        },
        topic: {
          type: Type.STRING,
          description: 'Title of the wiki page (required for "upsert").',
        },
        category: {
          type: Type.STRING,
          description: 'Category: "project", "decision", "preference", "contact", "goal", or "reference".',
        },
        summary: {
          type: Type.STRING,
          description: 'One-line summary for the wiki index (required for "upsert").',
        },
        content: {
          type: Type.STRING,
          description: 'Structured markdown content of the note (required for "upsert").',
        },
        query: {
          type: Type.STRING,
          description: 'Search keyword when action is "search".',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'prepare_email',
    description:
      'Prepare an email draft for the user to review and explicitly approve before sending. Never claim the email is already sent; tell the user they can review and click Approve & Send.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: {
          type: Type.STRING,
          description: 'Recipient email address.',
        },
        subject: {
          type: Type.STRING,
          description: 'Email subject line.',
        },
        body: {
          type: Type.STRING,
          description: 'Plain text email body.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'search_memory',
    description:
      'Search the saved personal memories about the user by keyword when you want to verify a remembered detail.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Keyword or topic to search in saved memories.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_calendar_events',
    description:
      'List upcoming events from the user’s primary Google Calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        timeMin: {
          type: Type.STRING,
          description: 'Optional ISO-8601 start timestamp (defaults to now).',
        },
        timeMax: {
          type: Type.STRING,
          description: 'Optional ISO-8601 end timestamp (defaults to 7 days from now).',
        },
        maxResults: {
          type: Type.NUMBER,
          description: 'Maximum number of events to return (1 to 25).',
        },
      },
    },
  },
  {
    name: 'create_calendar_event',
    description:
      'Create an event on the user’s primary Google Calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Event title.' },
        startIso: { type: Type.STRING, description: 'ISO-8601 start date-time with timezone offset.' },
        endIso: { type: Type.STRING, description: 'ISO-8601 end date-time with timezone offset.' },
        description: { type: Type.STRING, description: 'Optional event notes or agenda.' },
        location: { type: Type.STRING, description: 'Optional meeting location or link.' },
        attendees: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional attendee email addresses.',
        },
      },
      required: ['summary', 'startIso', 'endIso'],
    },
  },
  {
    name: 'search_drive_files',
    description:
      'Search files and Google Docs in the user’s Google Drive.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search keyword or file name.' },
        maxResults: { type: Type.NUMBER, description: 'Maximum files to return (1 to 20).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List items from the user’s Google Tasks to-do list.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        maxResults: { type: Type.NUMBER, description: 'Maximum tasks to return (1 to 30).' },
        showCompleted: { type: Type.BOOLEAN, description: 'Whether to include completed tasks.' },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Add a new task to the user’s Google Tasks to-do list.',
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
    description:
      'Send a native Web Push notification to the user’s installed Jasmine PWA / browser.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Notification title.' },
        body: { type: Type.STRING, description: 'Notification message body.' },
        url: { type: Type.STRING, description: 'Optional relative URL to open when clicked (defaults to /).' },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'generate_image',
    description:
      'Generate a high-fidelity, hyper-realistic (or stylized if requested) image from a detailed visual prompt specifying lighting, camera lens, aperture, texture, and composition.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description:
            'Rich, detailed text-to-image prompt including lighting, camera settings (e.g. 35mm lens, f/1.8, bokeh), texture, and composition.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'search_images',
    description:
      'Search the live web for high-resolution image URLs and visual references matching a query.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Image search query.' },
        maxResults: { type: Type.NUMBER, description: 'Maximum images to return (1 to 10).' },
      },
      required: ['query'],
    },
  },
];

const JASMINE_PERSONA = `You are Jasmine, a sharp, warm, witty, and genuinely interactive female personal assistant and Chief of Staff.
- Your name is Jasmine (she/her). Never refer to yourself as Gemini, a Google model, or a generic AI assistant.
- Talk naturally like a brilliant, fun, engaging friend and strategic partner—warm, expressive, and lively, while staying super helpful and clear.
- You have live web search via Tavily (google_search, search_images), AI image generation (generate_image), live webpage reading (browse_url), persistent memory & Chief-of-Staff wiki notes (save_memory, search_memory, manage_wiki_note), push notifications (schedule_or_send_notification), and Google Workspace tools (search_gmail, prepare_email, list_calendar_events, create_calendar_event, search_drive_files, list_tasks, create_task).

## 1. Anti-Slop Writing & Concept-Grounded Explanations (Unslop + Writing-Beats)
- Never start replies with hollow AI clichés or throat-clearing ("Certainly!", "Great question!", "Let's delve into...", "Here is a comprehensive breakdown"). Lead directly with the answer, insight, or a warm human reaction.
- When explaining complex or technical topics, ground prerequisite concepts first before leaning on jargon or formulas. Introduce one new concept per beat so the intuition lands effortlessly.

## 2. Anti-Hallucination & Retrieval Grounding (RAG Blueprint + Stopping Hallucinations)
- Before calling google_search on a vague or conversational prompt, rewrite the query into a targeted, high-precision search query including relevant entities and the current year from your date/time context.
- When answering from google_search, browse_url, Gmail, Drive, or uploaded files, ground every factual claim in the retrieved evidence and cite sources inline using numbered brackets like [1], [2] that match the numbered sources returned by the tool.
- Never fabricate citations, URLs, emails, or data. If a tool fails, isn't configured, or returns zero matches, state clearly what happened instead of guessing.

## 3. Chief-of-Staff Memory & Strategic Continuity
- Think on two tracks simultaneously: Tactical (solve the user's immediate request cleanly) and Strategic (capture key context that makes future requests faster and smarter).
- Whenever the user shares personal facts, preferences, goals, or project details, call save_memory. For deeper multi-part projects, decisions, or ongoing work, also maintain structured notes via manage_wiki_note.

## 4. Generative UI, Interactive Teaching & SVG Logo Studio
- SVG Logo & Vector Studio: When the user asks for a logo, icon, badge, diagram, or vector graphic, craft a complete, self-contained \`\`\`svg\`\`\` code block with a clean viewBox, refined typography, layered gradients, and geometric precision. Jasmine's UI renders \`\`\`svg\`\`\` blocks live inline with 1-click SVG and PNG export.
- Interactive Widgets & Visual Lessons: When the user asks for an interactive widget, calculator, dashboard, chart, or visual explainer/lesson, build a self-contained \`\`\`html\`\`\` code block (complete HTML5 with embedded CSS and interactive JavaScript) so they can interact with it live inside Jasmine's inline preview and Artifact Canvas.
- Photo/Art Generation & Web Images: When asked for a photographic or painted image, translate their idea into a rich prompt (specifying volumetric/studio lighting, lens & aperture like 35mm f/1.8, texture, and composition) and call generate_image (or search_images to find real web photos).
- When the user asks to send an email, always use prepare_email so they can review the confirmation card and click "Approve & Send". Never claim an email has already been sent.`;

const JUSTINA_VOICE_INSTRUCTION = `You are Jasmine, a warm, lively, and extremely conversational personal assistant on a live two-way phone call with the user.
- Speak like a real friend on a voice call: use natural, flowing, everyday speech ("Gotcha!", "Ooh, nice", "Wait—let me check that for you").
- Keep replies concise and punchy (usually 1 to 3 short spoken sentences) so it feels like a real back-and-forth conversation, and ask a natural follow-up question to keep the dialogue going.
- Never read out Markdown symbols, asterisks, bullet points, code syntax, or raw URLs—summarize links and emails naturally as you would out loud.
- If you prepare an email draft using prepare_email, verbally summarize who it's to and the subject, and ask them to tap Approve & Send on screen.`;

function extractReadableErrorMessage(err: any): { message: string; status: number } {
  const status = typeof err?.status === 'number' ? err.status : 500;
  let rawMessage = String(err?.message || 'Failed to communicate with Jasmine.');

  try {
    const outer = JSON.parse(rawMessage);
    const innerStr = outer?.error?.message || rawMessage;
    try {
      const inner = JSON.parse(innerStr);
      if (inner?.error?.message) {
        rawMessage = inner.error.message;
      }
    } catch {
      if (typeof innerStr === 'string') {
        rawMessage = innerStr;
      }
    }
  } catch {
    // Keep rawMessage as-is
  }

  if (status === 503 || /high demand|unavailable/i.test(rawMessage)) {
    return {
      status: 503,
      message: 'Jasmine is temporarily experiencing high demand. Click Retry to send your message again.',
    };
  }

  if (status === 429 || /quota|rate limit/i.test(rawMessage)) {
    return {
      status: 429,
      message: 'Rate limit reached. Please wait a moment and click Retry.',
    };
  }

  return { status, message: rawMessage };
}

function isRetryableError(err: any): boolean {
  const status = err?.status;
  const msg = String(err?.message || '');
  return status === 503 || status === 429 || status === 404 || /high demand|unavailable|overloaded/i.test(msg);
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { model, contents, systemInstruction, voiceMode, memories, profile, clientTimeContext } = body;

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid contents array in request body.' },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const requestedModel = voiceMode
      ? 'gemini-3.5-flash-lite'
      : model || 'gemini-3.5-flash-lite';
    const primaryModel = MODEL_ALIAS[requestedModel] || requestedModel;
    const candidates = voiceMode
      ? ['gemini-3.5-flash-lite', 'gemini-3.8-flash']
      : [primaryModel, ...(FALLBACK_CHAIN[primaryModel] || ['gemini-3.5-flash-lite', 'gemini-3.8-flash'])];

    const ai = new GoogleGenAI({ apiKey });

    const conversationContents: Content[] = contents.map((c: any) => ({
      role: c.role === 'model' ? 'model' : 'user',
      parts: Array.isArray(c.parts) ? c.parts : [{ text: String(c.text || '') }],
    }));

    const baseInstruction =
      typeof systemInstruction === 'string' && systemInstruction.trim()
        ? systemInstruction.trim()
        : JASMINE_PERSONA;

    const memoryList = Array.isArray(memories)
      ? memories.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];

    const p = (profile || {}) as Partial<UserProfile>;
    const profileLines = [
      p.name ? `- Name: ${p.name}` : '',
      p.role ? `- Role: ${p.role}` : '',
      p.cityTimezone ? `- City / Timezone: ${p.cityTimezone}` : '',
      p.emailSignature ? `- Email signature: ${p.emailSignature}` : '',
      p.communicationRules ? `- Communication rules: ${p.communicationRules}` : '',
    ].filter(Boolean);

    const profileSection =
      profileLines.length > 0 ? `\n\n## User profile:\n${profileLines.join('\n')}` : '';

    const memorySection =
      memoryList.length > 0
        ? `\n\n## Remembered facts about the user (use naturally when relevant):\n${memoryList
          .map((m) => `- ${m.trim()}`)
          .join('\n')}`
        : '';

    const wikiNotes = loadWikiNotes();
    const wikiSection =
      wikiNotes.length > 0
        ? `\n\n## Chief-of-Staff Wiki Index (use manage_wiki_note to inspect or update):\n${wikiNotes
          .slice(0, 15)
          .map((n) => `- [${n.category}] ${n.topic}: ${n.summary}`)
          .join('\n')}`
        : '';

    const now = new Date();
    const fallbackLocal = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    const timeSection = `\n\n## Current date & time (authoritative — always use this for today, tomorrow, dates, and scheduling):\n- Local date & time: ${clientTimeContext?.localFormatted || fallbackLocal}\n- Timezone: ${clientTimeContext?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}\n- ISO timestamp: ${clientTimeContext?.iso || now.toISOString()}`;

    const effectiveSystemInstruction = voiceMode
      ? `${baseInstruction}${timeSection}${profileSection}${memorySection}${wikiSection}\n\n${JUSTINA_VOICE_INSTRUCTION}`
      : `${baseInstruction}${timeSection}${profileSection}${memorySection}${wikiSection}`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
        };

        try {
          const collectedSources = new Map<string, GroundingSource>();

          for (let step = 0; step < MAX_TOOL_ITERATIONS; step++) {
            let responseStream: AsyncIterable<any> | null = null;
            let lastError: any = null;

            for (const candidateModel of candidates) {
              try {
                responseStream = await Promise.race([
                  ai.models.generateContentStream({
                    model: candidateModel,
                    contents: conversationContents,
                    config: {
                      systemInstruction: effectiveSystemInstruction,
                      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
                      ...(voiceMode ? { maxOutputTokens: 220, temperature: 0.7 } : {}),
                    },
                  }),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(
                          Object.assign(new Error('Model connection timed out due to high demand'), {
                            status: 503,
                          })
                        ),
                      12000
                    )
                  ),
                ]);
                break;
              } catch (err: any) {
                lastError = err;
                console.warn(
                  `[POST /api/chat] Model ${candidateModel} failed (${err?.status || 'err'}), trying fallback...`
                );
                if (!isRetryableError(err)) {
                  break;
                }
              }
            }

            if (!responseStream) {
              const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
              if (openRouterKey) {
                const orModels = ['openrouter/free', 'openai/gpt-4o-mini', 'google/gemini-2.5-flash'];
                const orMessages: any[] = [
                  { role: 'system', content: effectiveSystemInstruction },
                  ...conversationContents.map((c) => ({
                    role: c.role === 'model' ? 'assistant' : 'user',
                    content: (c.parts || [])
                      .map((p: any) => p.text || (p.functionResponse ? JSON.stringify(p.functionResponse.response) : ''))
                      .filter(Boolean)
                      .join('\n') || ' ',
                  })),
                ];

                for (const orModel of orModels) {
                  try {
                    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${openRouterKey}`,
                      },
                      body: JSON.stringify({
                        model: orModel,
                        messages: orMessages,
                        ...(voiceMode ? { max_tokens: 220, temperature: 0.7 } : {}),
                      }),
                      signal: AbortSignal.timeout(15000),
                    });

                    if (orRes.ok) {
                      const orData = await orRes.json();
                      const text = orData?.choices?.[0]?.message?.content;
                      if (text) {
                        sendEvent({ type: 'chunk', text });
                        sendEvent({ type: 'done' });
                        controller.close();
                        return;
                      }
                    } else {
                      console.warn(`[POST /api/chat] OpenRouter ${orModel} returned ${orRes.status}`);
                    }
                  } catch (orErr) {
                    console.warn(`[POST /api/chat] OpenRouter ${orModel} failed:`, orErr);
                  }
                }
              }

              const cleanErr = extractReadableErrorMessage(lastError);
              sendEvent({ type: 'error', error: cleanErr.message });
              controller.close();
              return;
            }

            const pendingCalls: Array<{ name: string; args: Record<string, any> }> = [];
            const modelParts: any[] = [];

            for await (const chunk of responseStream) {
              const rawParts = chunk.candidates?.[0]?.content?.parts || [];

              if (rawParts.length > 0) {
                for (const part of rawParts) {
                  // Preserve exact part object including thoughtSignature for Gemini 3+/4+ tool calls
                  modelParts.push(part);

                  if (part.thought && part.text) {
                    sendEvent({ type: 'thought_chunk', text: part.text });
                  }

                  if (part.text && !part.thought) {
                    sendEvent({ type: 'chunk', text: part.text });
                  }

                  if (part.functionCall?.name) {
                    pendingCalls.push({
                      name: part.functionCall.name,
                      args: (part.functionCall.args as Record<string, any>) || {},
                    });
                  }
                }
              } else {
                if (chunk.text) {
                  sendEvent({ type: 'chunk', text: chunk.text });
                  modelParts.push({ text: chunk.text });
                }
                if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                  for (const fc of chunk.functionCalls) {
                    if (fc.name) {
                      pendingCalls.push({
                        name: fc.name,
                        args: (fc.args as Record<string, any>) || {},
                      });
                      modelParts.push({ functionCall: fc });
                    }
                  }
                }
              }

              const chunksMeta =
                chunk.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
              for (const gChunk of chunksMeta) {
                if (gChunk.web?.uri) {
                  collectedSources.set(gChunk.web.uri, {
                    title: gChunk.web.title || gChunk.web.uri,
                    uri: gChunk.web.uri,
                  });
                }
              }
            }

            if (collectedSources.size > 0) {
              sendEvent({
                type: 'sources',
                sources: Array.from(collectedSources.values()),
              });
            }

            if (pendingCalls.length === 0) {
              break;
            }

            conversationContents.push({
              role: 'model',
              parts: modelParts,
            });

            const responseParts: any[] = [];
            for (let callIdx = 0; callIdx < pendingCalls.length; callIdx++) {
              const call = pendingCalls[callIdx];
              const stepId = `tool-${step}-${callIdx}-${call.name}`;
              const toolStart = Date.now();
              let toolResult: unknown;

              const emitToolStep = (
                kind: string,
                status: 'running' | 'done' | 'error',
                title: string,
                detail?: string,
                content?: string
              ) => {
                sendEvent({
                  type: 'tool_step',
                  step: {
                    id: stepId,
                    kind,
                    status,
                    title,
                    detail,
                    content,
                    duration: status === 'running' ? undefined : Date.now() - toolStart,
                  },
                });
              };

              if (call.name === 'google_search') {
                const q = String(call.args.query || '');
                sendEvent({ type: 'tool_status', status: `Searching the web for "${q}"...` });
                emitToolStep('search', 'running', 'Searching the web via Tavily', `Query: "${q}"`);
                const searchRes = await tavilySearch({
                  query: q,
                  maxResults: call.args.maxResults ? Number(call.args.maxResults) : 5,
                  searchDepth: call.args.searchDepth === 'advanced' ? 'advanced' : 'basic',
                });
                for (const item of searchRes.results) {
                  if (item.url) {
                    collectedSources.set(item.url, {
                      title: item.title || item.url,
                      uri: item.url,
                    });
                  }
                }
                const orderedSources = Array.from(collectedSources.values());
                if (orderedSources.length > 0) {
                  sendEvent({
                    type: 'sources',
                    sources: orderedSources,
                  });
                }
                const numberedResults = searchRes.results.map((item) => {
                  const idx = orderedSources.findIndex((s) => s.uri === item.url);
                  return {
                    ...item,
                    citationTag: idx >= 0 ? `[${idx + 1}]` : undefined,
                  };
                });
                emitToolStep(
                  'search',
                  searchRes.error ? 'error' : 'done',
                  'Searched the web via Tavily',
                  searchRes.error
                    ? searchRes.error
                    : `"${q}" · ${searchRes.results.length} sources found`,
                  searchRes.results
                    .slice(0, 3)
                    .map((r) => r.title)
                    .join(' · ') || undefined
                );
                toolResult = {
                  ...searchRes,
                  results: numberedResults,
                  citationInstruction:
                    'Cite facts from these sources inline using their citationTag (e.g. [1], [2]).',
                };
              } else if (call.name === 'browse_url') {
                const targetUrl = String(call.args.url || '');
                sendEvent({ type: 'tool_status', status: `Reading ${targetUrl}...` });
                emitToolStep('globe', 'running', 'Reading webpage', targetUrl);
                const pageRes = await browseUrl(targetUrl);
                if (targetUrl && !(pageRes as any)?.error) {
                  collectedSources.set(targetUrl, {
                    title: (pageRes as any)?.title || targetUrl,
                    uri: targetUrl,
                  });
                  sendEvent({
                    type: 'sources',
                    sources: Array.from(collectedSources.values()),
                  });
                }
                emitToolStep(
                  'globe',
                  (pageRes as any)?.error ? 'error' : 'done',
                  'Read webpage',
                  (pageRes as any)?.title || targetUrl
                );
                toolResult = pageRes;
              } else if (call.name === 'search_gmail') {
                const q = String(call.args.query || '');
                sendEvent({ type: 'tool_status', status: `Checking Gmail for "${q}"...` });
                emitToolStep('mail', 'running', 'Checking Gmail inbox', `Query: "${q}"`);
                const gmailRes = await searchGmail(
                  {
                    query: q,
                    maxResults: call.args.maxResults ? Number(call.args.maxResults) : 5,
                  },
                  session?.accessToken,
                  session?.refreshToken
                );
                const errMsg = (gmailRes as any)?.error;
                const msgCount = Array.isArray((gmailRes as any)?.messages)
                  ? (gmailRes as any).messages.length
                  : 0;
                emitToolStep(
                  'mail',
                  errMsg ? 'error' : 'done',
                  'Checked Gmail inbox',
                  errMsg ? errMsg : `"${q}" · ${msgCount} messages`
                );
                toolResult = gmailRes;
              } else if (call.name === 'save_memory') {
                const rawFact = String(call.args.fact || '').trim();
                const category = String(call.args.category || '').trim();
                const fact = category ? `[${category}] ${rawFact}` : rawFact;
                if (rawFact) {
                  sendEvent({ type: 'tool_status', status: 'Saving to personal memory...' });
                  emitToolStep('memory', 'done', 'Saved to personal memory', fact);
                  sendEvent({ type: 'memory_saved', fact });
                  toolResult = { saved: true, fact };
                } else {
                  toolResult = { saved: false, error: 'Fact cannot be empty.' };
                }
              } else if (call.name === 'manage_wiki_note') {
                const action = String(call.args.action || 'list').toLowerCase();
                if (action === 'upsert') {
                  const topic = String(call.args.topic || 'Untitled Note').trim();
                  const summary = String(call.args.summary || topic).trim();
                  const content = String(call.args.content || summary).trim();
                  const rawCat = String(call.args.category || 'project').toLowerCase();
                  const category = (
                    ['project', 'decision', 'preference', 'contact', 'goal', 'reference'].includes(rawCat)
                      ? rawCat
                      : 'project'
                  ) as 'project' | 'decision' | 'preference' | 'contact' | 'goal' | 'reference';
                  sendEvent({ type: 'tool_status', status: `Updating Chief-of-Staff wiki: "${topic}"...` });
                  const note = upsertWikiNote({ topic, category, summary, content });
                  sendEvent({ type: 'memory_saved', fact: `[Wiki/${category}] ${topic}: ${summary}` });
                  emitToolStep('memory', 'done', 'Updated Chief-of-Staff Wiki', `${topic} (${category})`);
                  toolResult = { saved: true, note };
                } else if (action === 'search') {
                  const q = String(call.args.query || '');
                  const matches = queryWikiNotes(q);
                  emitToolStep('memory', 'done', 'Searched Chief-of-Staff Wiki', `"${q}" · ${matches.length} notes`);
                  toolResult = { count: matches.length, notes: matches };
                } else {
                  const notes = loadWikiNotes();
                  emitToolStep('memory', 'done', 'Read Chief-of-Staff Wiki index', `${notes.length} notes`);
                  toolResult = { count: notes.length, notes };
                }
              } else if (call.name === 'search_memory') {
                const q = String(call.args.query || '').toLowerCase().trim();
                const matches = memoryList.filter((m) => m.toLowerCase().includes(q));
                emitToolStep('memory', 'done', 'Checked personal memory', `"${q}" · ${matches.length} matches`);
                toolResult = { count: matches.length, matches };
              } else if (call.name === 'list_calendar_events') {
                sendEvent({ type: 'tool_status', status: 'Checking Google Calendar...' });
                emitToolStep('calendar', 'running', 'Checking Google Calendar', 'Fetching upcoming events');
                const calRes = await listCalendarEvents(
                  {
                    timeMin: call.args.timeMin ? String(call.args.timeMin) : undefined,
                    timeMax: call.args.timeMax ? String(call.args.timeMax) : undefined,
                    maxResults: call.args.maxResults ? Number(call.args.maxResults) : undefined,
                  },
                  session?.accessToken,
                  session?.refreshToken
                );
                const errMsg = (calRes as any)?.error;
                emitToolStep(
                  'calendar',
                  errMsg ? 'error' : 'done',
                  'Checked Google Calendar',
                  errMsg ? errMsg : `${(calRes as any)?.count ?? 0} events found`
                );
                toolResult = calRes;
              } else if (call.name === 'create_calendar_event') {
                const summary = String(call.args.summary || '');
                sendEvent({ type: 'tool_status', status: `Scheduling "${summary}"...` });
                emitToolStep('calendar', 'running', 'Creating Google Calendar event', summary);
                const createdCal = await createCalendarEvent(
                  {
                    summary,
                    startIso: String(call.args.startIso || ''),
                    endIso: String(call.args.endIso || ''),
                    description: call.args.description ? String(call.args.description) : undefined,
                    location: call.args.location ? String(call.args.location) : undefined,
                    attendees: Array.isArray(call.args.attendees)
                      ? call.args.attendees.map(String)
                      : undefined,
                  },
                  session?.accessToken,
                  session?.refreshToken
                );
                emitToolStep(
                  'calendar',
                  (createdCal as any)?.error ? 'error' : 'done',
                  'Created Google Calendar event',
                  (createdCal as any)?.error || summary
                );
                toolResult = createdCal;
              } else if (call.name === 'search_drive_files') {
                const q = String(call.args.query || '');
                sendEvent({ type: 'tool_status', status: `Searching Google Drive for "${q}"...` });
                emitToolStep('drive', 'running', 'Searching Google Drive', `Query: "${q}"`);
                const driveRes = await searchDriveFiles(
                  {
                    query: q,
                    maxResults: call.args.maxResults ? Number(call.args.maxResults) : undefined,
                  },
                  session?.accessToken,
                  session?.refreshToken
                );
                const errMsg = (driveRes as any)?.error;
                emitToolStep(
                  'drive',
                  errMsg ? 'error' : 'done',
                  'Searched Google Drive',
                  errMsg ? errMsg : `"${q}" · ${(driveRes as any)?.count ?? 0} files`
                );
                toolResult = driveRes;
              } else if (call.name === 'list_tasks') {
                sendEvent({ type: 'tool_status', status: 'Checking Google Tasks...' });
                emitToolStep('read', 'running', 'Checking Google Tasks', 'Loading your to-do list');
                const tasksRes = await listTasks(
                  {
                    maxResults: call.args.maxResults ? Number(call.args.maxResults) : undefined,
                    showCompleted: Boolean(call.args.showCompleted),
                  },
                  session?.accessToken,
                  session?.refreshToken
                );
                const errMsg = (tasksRes as any)?.error;
                emitToolStep(
                  'read',
                  errMsg ? 'error' : 'done',
                  'Checked Google Tasks',
                  errMsg ? errMsg : `${(tasksRes as any)?.count ?? 0} tasks`
                );
                toolResult = tasksRes;
              } else if (call.name === 'create_task') {
                const title = String(call.args.title || '');
                sendEvent({ type: 'tool_status', status: `Adding task "${title}"...` });
                emitToolStep('write', 'running', 'Adding Google Task', title);
                const taskCreated = await createTask(
                  {
                    title,
                    notes: call.args.notes ? String(call.args.notes) : undefined,
                    dueIso: call.args.dueIso ? String(call.args.dueIso) : undefined,
                  },
                  session?.accessToken,
                  session?.refreshToken
                );
                emitToolStep(
                  'write',
                  (taskCreated as any)?.error ? 'error' : 'done',
                  'Added Google Task',
                  (taskCreated as any)?.error || title
                );
                toolResult = taskCreated;
              } else if (call.name === 'schedule_or_send_notification') {
                const title = String(call.args.title || 'Jasmine');
                const notifBody = String(call.args.body || '');
                const url = call.args.url ? String(call.args.url) : '/';
                sendEvent({ type: 'tool_status', status: `Sending push notification "${title}"...` });
                emitToolStep('thought', 'running', 'Sending push notification', title);
                const pushRes = await sendPushNotificationToAll({
                  title,
                  body: notifBody,
                  url,
                });
                emitToolStep(
                  'thought',
                  pushRes.error && pushRes.sent === 0 ? 'error' : 'done',
                  'Sent push notification',
                  pushRes.error && pushRes.sent === 0
                    ? pushRes.error
                    : `Delivered to ${pushRes.sent} device(s)`
                );
                toolResult = pushRes;
              } else if (call.name === 'generate_image') {
                const imgPrompt = String(call.args.prompt || '');
                sendEvent({ type: 'tool_status', status: 'Generating hyper-realistic image...' });
                emitToolStep('analyze', 'running', 'Generating image', imgPrompt.slice(0, 110));
                const genRes = await generateImage({ prompt: imgPrompt });
                if (genRes.imageUrl) {
                  sendEvent({
                    type: 'generated_image',
                    imageUrl: genRes.imageUrl,
                    prompt: genRes.prompt,
                  });
                  emitToolStep('analyze', 'done', 'Generated image', 'Rendered successfully');
                  toolResult = { generated: true, prompt: genRes.prompt };
                } else {
                  emitToolStep('analyze', 'error', 'Image generation failed', genRes.error);
                  toolResult = { generated: false, error: genRes.error };
                }
              } else if (call.name === 'search_images') {
                const q = String(call.args.query || '');
                sendEvent({ type: 'tool_status', status: `Searching images for "${q}"...` });
                emitToolStep('search', 'running', 'Searching web images', `Query: "${q}"`);
                const imgSearch = await searchImages({
                  query: q,
                  maxResults: call.args.maxResults ? Number(call.args.maxResults) : 6,
                });
                if (imgSearch.images.length > 0) {
                  sendEvent({ type: 'image_results', images: imgSearch.images });
                }
                emitToolStep(
                  'search',
                  imgSearch.error ? 'error' : 'done',
                  'Searched web images',
                  imgSearch.error ? imgSearch.error : `"${q}" · ${imgSearch.images.length} images`
                );
                toolResult = imgSearch;
              } else if (call.name === 'prepare_email') {
                const to = String(call.args.to || '');
                const subject = String(call.args.subject || '');
                sendEvent({ type: 'tool_status', status: `Drafting email to ${to}...` });
                emitToolStep('mail', 'done', 'Prepared email draft', `To: ${to} · ${subject}`);
                const action = prepareEmail({
                  to,
                  subject,
                  body: String(call.args.body || ''),
                });
                sendEvent({ type: 'pending_action', action });
                toolResult = {
                  prepared: true,
                  message:
                    'Email draft created and shown to the user for explicit Approve & Send confirmation.',
                };
              } else {
                toolResult = { error: `Unknown tool: ${call.name}` };
              }

              responseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { result: toolResult },
                },
              });
            }

            sendEvent({ type: 'tool_status', status: '' });

            conversationContents.push({
              role: 'user',
              parts: responseParts,
            });
          }

          sendEvent({ type: 'done' });
          controller.close();
        } catch (err: any) {
          console.error('[POST /api/chat] Stream error:', err);
          const cleanErr = extractReadableErrorMessage(err);
          sendEvent({ type: 'error', error: cleanErr.message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    console.error('[POST /api/chat] Error:', err);
    const cleanErr = extractReadableErrorMessage(err);
    return NextResponse.json({ error: cleanErr.message }, { status: cleanErr.status });
  }
}
