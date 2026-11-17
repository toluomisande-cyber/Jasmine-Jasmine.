import { create } from 'zustand';
import {
  ArtifactItem,
  Attachment,
  ChatThread,
  DEFAULT_MODEL_ID,
  GeminiContent,
  GeminiPart,
  GroundingSource,
  Message,
  PendingEmailAction,
  ReasoningStep,
  UserProfile,
} from '../types/chat';
import { storageAdapter } from '../services/storageAdapter';
import { requestThreadTitle } from '../services/generateThreadTitle';
import { speakTextAloud, stopSpeechOutput } from '../utils/speechOutput';

let activeAbortController: AbortController | null = null;
let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCloudSync(getState: () => ChatState) {
  if (typeof window === 'undefined') return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    const s = getState();
    void fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threads: s.threads,
        threadOrder: s.threadOrder,
        messagesByThread: s.messagesByThread,
        memories: s.memories,
        profile: s.profile,
      }),
    }).catch(() => {
      // Ignore network/offline errors
    });
  }, 1500);
}

interface ChatState {
  threads: Record<string, ChatThread>;
  threadOrder: string[];
  messagesByThread: Record<string, Message[]>;
  activeThreadId: string | null;
  selectedModel: string;
  streamingMessageId: string | null;
  searchQuery: string;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  voiceModeOpen: boolean;
  autoSpeak: boolean;
  speakingMessageId: string | null;
  memories: string[];
  profile: UserProfile;
  profileModalOpen: boolean;
  commandPaletteOpen: boolean;
  activeArtifact: ArtifactItem | null;

  // Actions
  initFromStorage: () => void;
  addMemory: (fact: string) => void;
  removeMemory: (index: number) => void;
  clearMemories: () => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setProfileModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openArtifact: (params: { title: string; language: string; content: string }) => void;
  setArtifactVersion: (index: number) => void;
  closeArtifact: () => void;
  editAndResendMessage: (messageId: string, newContent: string) => Promise<void>;
  toggleTheme: () => void;
  setVoiceModeOpen: (open: boolean) => void;
  toggleAutoSpeak: () => void;
  speakMessage: (messageId: string, text: string) => void;
  stopSpeaking: () => void;
  setActiveThread: (threadId: string | null) => void;
  setSelectedModel: (model: string) => void;
  setSearchQuery: (query: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  createThread: (title?: string, modelOverride?: string) => string;
  renameThread: (threadId: string, newTitle: string) => void;
  togglePinThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  setMessageFeedback: (threadId: string, messageId: string, feedback: 'up' | 'down' | undefined) => void;
  updatePendingEmailStatus: (
    threadId: string,
    messageId: string,
    status: 'pending' | 'sent' | 'cancelled',
    updatedPayload?: { to: string; subject: string; body: string }
  ) => void;
  sendMessage: (
    prompt: string,
    attachments?: Attachment[],
    options?: { voiceMode?: boolean }
  ) => Promise<Message | null>;
  regenerateMessage: (targetAssistantMessageId?: string) => Promise<void>;
  stopStreaming: () => void;
  appendStreamChunk: (messageId: string, chunk: string) => void;
  finalizeMessage: (
    messageId: string,
    status: 'complete' | 'stopped' | 'error',
    errorMessage?: string
  ) => void;
}

function buildGeminiContents(messages: Message[]): GeminiContent[] {
  // Take the last 24 valid messages
  const validMessages = messages.filter(
    (m) => m.status === 'complete' || m.status === 'stopped'
  );
  const sliced = validMessages.slice(-24);

  return sliced.map((m) => {
    const parts: GeminiPart[] = [];

    // Attachments first if user message
    if (m.attachments && m.attachments.length > 0) {
      for (const att of m.attachments) {
        if (att.source === 'inline' && att.base64Data) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64Data,
            },
          });
        } else if (att.source === 'files_api' && att.fileUri) {
          parts.push({
            fileData: {
              fileUri: att.fileUri,
              mimeType: att.mimeType,
            },
          });
        }
      }
    }

    if (m.content) {
      parts.push({ text: m.content });
    } else if (parts.length === 0) {
      parts.push({ text: ' ' });
    }

    return {
      role: m.role === 'model' ? 'model' : 'user',
      parts,
    };
  });
}

export const useChatStore = create<ChatState>((set, get) => ({
  threads: {},
  threadOrder: [],
  messagesByThread: {},
  activeThreadId: null,
  selectedModel: DEFAULT_MODEL_ID,
  streamingMessageId: null,
  searchQuery: '',
  sidebarOpen: true,
  theme: 'light',
  voiceModeOpen: false,
  autoSpeak: true,
  speakingMessageId: null,
  memories: [],
  profile: {
    name: '',
    cityTimezone: '',
    role: '',
    emailSignature: '',
    communicationRules: '',
  },
  profileModalOpen: false,
  commandPaletteOpen: false,
  activeArtifact: null,

  addMemory: (fact: string) => {
    const cleaned = fact.trim();
    if (!cleaned) return;
    const current = get().memories;
    if (current.some((m) => m.toLowerCase() === cleaned.toLowerCase())) return;
    const next = [...current, cleaned].slice(-50);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('jasmine_user_memories', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
    }
    set({ memories: next });
    scheduleCloudSync(get);
  },

  removeMemory: (index: number) => {
    const next = get().memories.filter((_, idx) => idx !== index);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('jasmine_user_memories', JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    set({ memories: next });
    scheduleCloudSync(get);
  },

  clearMemories: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('jasmine_user_memories');
      } catch {
        // ignore
      }
    }
    set({ memories: [] });
  },

  setVoiceModeOpen: (open: boolean) => set({ voiceModeOpen: open }),
  setProfileModalOpen: (open: boolean) => set({ profileModalOpen: open }),
  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),

  updateProfile: (patch: Partial<UserProfile>) => {
    const next = { ...get().profile, ...patch };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('jasmine_user_profile', JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    set({ profile: next });
    scheduleCloudSync(get);
  },

  openArtifact: ({ title, language, content }) => {
    const current = get().activeArtifact;
    if (current && current.title === title && current.language === language) {
      const last = current.versions[current.versions.length - 1];
      const versions = last === content ? current.versions : [...current.versions, content];
      set({
        activeArtifact: {
          ...current,
          versions,
          activeVersionIndex: versions.length - 1,
        },
      });
      return;
    }
    set({
      activeArtifact: {
        id: `art_${Date.now()}`,
        title,
        language,
        versions: [content],
        activeVersionIndex: 0,
      },
    });
  },

  setArtifactVersion: (index: number) => {
    const current = get().activeArtifact;
    if (!current) return;
    if (index < 0 || index >= current.versions.length) return;
    set({
      activeArtifact: {
        ...current,
        activeVersionIndex: index,
      },
    });
  },

  closeArtifact: () => set({ activeArtifact: null }),

  editAndResendMessage: async (messageId: string, newContent: string) => {
    const { activeThreadId, messagesByThread, stopStreaming, sendMessage } = get();
    if (!activeThreadId) return;
    const cleaned = newContent.trim();
    if (!cleaned) return;

    stopStreaming();
    const msgs = messagesByThread[activeThreadId] || [];
    const targetIndex = msgs.findIndex((m) => m.id === messageId && m.role === 'user');
    if (targetIndex === -1) return;

    const targetAttachments = msgs[targetIndex].attachments;
    const truncated = msgs.slice(0, targetIndex);
    storageAdapter.saveMessages(activeThreadId, truncated);
    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [activeThreadId]: truncated,
      },
    }));

    await sendMessage(cleaned, targetAttachments);
  },

  toggleAutoSpeak: () => {
    const next = !get().autoSpeak;
    storageAdapter.saveAutoSpeak(next);
    if (!next) {
      stopSpeechOutput();
      set({ autoSpeak: next, speakingMessageId: null });
    } else {
      set({ autoSpeak: next });
    }
  },

  speakMessage: (messageId: string, text: string) => {
    speakTextAloud(text, {
      onStart: () => set({ speakingMessageId: messageId }),
      onEnd: () => {
        if (get().speakingMessageId === messageId) {
          set({ speakingMessageId: null });
        }
      },
    });
  },

  stopSpeaking: () => {
    stopSpeechOutput();
    set({ speakingMessageId: null });
  },

  initFromStorage: () => {
    const { threads: rawThreads, threadOrder } = storageAdapter.loadThreads();
    const loadedModel = storageAdapter.loadDefaultModel();
    const defaultModel =
      loadedModel === 'gemini-2.5-flash' || loadedModel === 'gemini-3.8-flash'
        ? DEFAULT_MODEL_ID
        : loadedModel;
    const sidebarOpen = storageAdapter.loadSidebarState();
    const savedActiveId = storageAdapter.loadActiveThreadId();
    const activeThreadId = savedActiveId && rawThreads[savedActiveId] ? savedActiveId : null;
    const theme = storageAdapter.loadTheme();
    const autoSpeak = storageAdapter.loadAutoSpeak();
    let memories: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const rawMem = localStorage.getItem('jasmine_user_memories');
        const parsed = rawMem ? JSON.parse(rawMem) : [];
        if (Array.isArray(parsed)) {
          memories = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        }
      } catch {
        memories = [];
      }
    }

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }

    // Migrate legacy models on existing threads so Retry uses fast reliable models
    const threads: Record<string, ChatThread> = {};
    for (const [id, t] of Object.entries(rawThreads)) {
      const needsMigration = t.model === 'gemini-2.5-flash' || t.model === 'gemini-3.8-flash';
      threads[id] = needsMigration ? { ...t, model: DEFAULT_MODEL_ID } : t;
    }

    // Preload messages for currently existing threads
    const messagesByThread: Record<string, Message[]> = {};
    for (const threadId of threadOrder) {
      messagesByThread[threadId] = storageAdapter.loadMessages(threadId);
    }

    let profile: UserProfile = {
      name: '',
      cityTimezone: '',
      role: '',
      emailSignature: '',
      communicationRules: '',
    };
    if (typeof window !== 'undefined') {
      try {
        const rawProf = localStorage.getItem('jasmine_user_profile');
        if (rawProf) {
          profile = { ...profile, ...JSON.parse(rawProf) };
        }
      } catch {
        // ignore
      }
    }

    set({
      threads,
      threadOrder,
      messagesByThread,
      selectedModel: defaultModel,
      sidebarOpen,
      activeThreadId,
      theme,
      autoSpeak,
      memories,
      profile,
    });

    if (typeof window !== 'undefined') {
      void fetch('/api/sync')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.configured || !data?.authenticated || !data?.state) return;
          const remote = data.state;
          set((state) => ({
            threads: remote.threads || state.threads,
            threadOrder: Array.isArray(remote.threadOrder) ? remote.threadOrder : state.threadOrder,
            messagesByThread: remote.messagesByThread || state.messagesByThread,
            memories: Array.isArray(remote.memories) ? remote.memories : state.memories,
            profile: remote.profile ? { ...state.profile, ...remote.profile } : state.profile,
          }));
        })
        .catch(() => {
          // Ignore sync fetch errors
        });
    }
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    storageAdapter.saveTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
    set({ theme: next });
  },

  setActiveThread: (threadId: string | null) => {
    storageAdapter.saveActiveThreadId(threadId);
    if (threadId && !get().messagesByThread[threadId]) {
      const loaded = storageAdapter.loadMessages(threadId);
      set((state) => ({
        activeThreadId: threadId,
        messagesByThread: { ...state.messagesByThread, [threadId]: loaded },
      }));
    } else {
      set({ activeThreadId: threadId });
    }
  },

  setSelectedModel: (model: string) => {
    storageAdapter.saveDefaultModel(model);
    set({ selectedModel: model });

    // Update active thread's model if currently in a thread
    const { activeThreadId, threads } = get();
    if (activeThreadId && threads[activeThreadId]) {
      const updated = {
        ...threads,
        [activeThreadId]: { ...threads[activeThreadId], model },
      };
      storageAdapter.saveThreads(updated, get().threadOrder);
      set({ threads: updated });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setSidebarOpen: (open: boolean) => {
    storageAdapter.saveSidebarState(open);
    set({ sidebarOpen: open });
  },

  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    storageAdapter.saveSidebarState(next);
    set({ sidebarOpen: next });
  },

  createThread: (title = 'New Chat', modelOverride?: string) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `th_${Date.now()}`;
    const model = modelOverride || get().selectedModel || DEFAULT_MODEL_ID;
    const now = Date.now();

    const newThread: ChatThread = {
      id,
      title,
      titleStatus: 'pending',
      model,
      createdAt: now,
      updatedAt: now,
    };

    const nextThreads = { [id]: newThread, ...get().threads };
    const nextOrder = [id, ...get().threadOrder.filter((tId) => tId !== id)];

    storageAdapter.saveThreads(nextThreads, nextOrder);
    storageAdapter.saveMessages(id, []);
    storageAdapter.saveActiveThreadId(id);

    set((state) => ({
      threads: nextThreads,
      threadOrder: nextOrder,
      messagesByThread: { ...state.messagesByThread, [id]: [] },
      activeThreadId: id,
    }));

    return id;
  },

  renameThread: (threadId: string, newTitle: string) => {
    const { threads, threadOrder } = get();
    const target = threads[threadId];
    if (!target) return;

    const updated = {
      ...threads,
      [threadId]: {
        ...target,
        title: newTitle.trim() || target.title,
        titleStatus: 'generated' as const, // Prevents auto-overwrite
        updatedAt: Date.now(),
      },
    };

    storageAdapter.saveThreads(updated, threadOrder);
    set({ threads: updated });
  },

  togglePinThread: (threadId: string) => {
    const { threads, threadOrder } = get();
    const target = threads[threadId];
    if (!target) return;

    const updated = {
      ...threads,
      [threadId]: {
        ...target,
        pinned: !target.pinned,
      },
    };

    storageAdapter.saveThreads(updated, threadOrder);
    set({ threads: updated });
  },

  setMessageFeedback: (threadId: string, messageId: string, feedback: 'up' | 'down' | undefined) => {
    const { messagesByThread } = get();
    const current = messagesByThread[threadId] || [];
    const updated = current.map((m) =>
      m.id === messageId ? { ...m, feedback } : m
    );
    storageAdapter.saveMessages(threadId, updated);
    set({
      messagesByThread: {
        ...messagesByThread,
        [threadId]: updated,
      },
    });
  },

  updatePendingEmailStatus: (
    threadId: string,
    messageId: string,
    status: 'pending' | 'sent' | 'cancelled',
    updatedPayload?: { to: string; subject: string; body: string }
  ) => {
    const { messagesByThread } = get();
    const current = messagesByThread[threadId] || [];
    const updated = current.map((m) => {
      if (m.id !== messageId || !m.pendingAction) return m;
      return {
        ...m,
        pendingAction: {
          ...m.pendingAction,
          status,
          payload: updatedPayload ? { ...updatedPayload } : m.pendingAction.payload,
        },
      };
    });
    storageAdapter.saveMessages(threadId, updated);
    set({
      messagesByThread: {
        ...messagesByThread,
        [threadId]: updated,
      },
    });
  },

  deleteThread: (threadId: string) => {
    const { threads, threadOrder, activeThreadId, messagesByThread } = get();
    const nextThreads = { ...threads };
    delete nextThreads[threadId];

    const nextOrder = threadOrder.filter((id) => id !== threadId);
    const nextMessages = { ...messagesByThread };
    delete nextMessages[threadId];

    storageAdapter.deleteThreadStorage(threadId);
    storageAdapter.saveThreads(nextThreads, nextOrder);

    let nextActiveId = activeThreadId;
    if (activeThreadId === threadId) {
      nextActiveId = nextOrder.length > 0 ? nextOrder[0] : null;
      storageAdapter.saveActiveThreadId(nextActiveId);
    }

    set({
      threads: nextThreads,
      threadOrder: nextOrder,
      messagesByThread: nextMessages,
      activeThreadId: nextActiveId,
    });
  },

  appendStreamChunk: (messageId: string, chunk: string) => {
    // IN-MEMORY UPDATE ONLY for maximum streaming throughput
    const { activeThreadId, messagesByThread } = get();
    if (!activeThreadId) return;

    const currentMessages = messagesByThread[activeThreadId] || [];
    const updated = currentMessages.map((msg) =>
      msg.id === messageId ? { ...msg, content: msg.content + chunk } : msg
    );

    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [activeThreadId]: updated,
      },
    }));
  },

  finalizeMessage: (
    messageId: string,
    status: 'complete' | 'stopped' | 'error',
    errorMessage?: string
  ) => {
    const { activeThreadId, messagesByThread, threads, threadOrder } = get();
    if (!activeThreadId) return;

    const currentMessages = messagesByThread[activeThreadId] || [];
    const updated = currentMessages.map((msg) =>
      msg.id === messageId
        ? {
          ...msg,
          status,
          errorMessage: errorMessage || msg.errorMessage,
        }
        : msg
    );

    // Commit to localStorage once finalized
    storageAdapter.saveMessages(activeThreadId, updated);

    // Update thread updatedAt
    if (threads[activeThreadId]) {
      const updatedThreads = {
        ...threads,
        [activeThreadId]: {
          ...threads[activeThreadId],
          updatedAt: Date.now(),
        },
      };
      storageAdapter.saveThreads(updatedThreads, threadOrder);
      set({
        messagesByThread: { ...messagesByThread, [activeThreadId]: updated },
        threads: updatedThreads,
        streamingMessageId: null,
      });
    } else {
      set({
        messagesByThread: { ...messagesByThread, [activeThreadId]: updated },
        streamingMessageId: null,
      });
    }
  },

  stopStreaming: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    const { streamingMessageId } = get();
    if (streamingMessageId) {
      get().finalizeMessage(streamingMessageId, 'stopped');
    }
  },

  sendMessage: async (
    prompt: string,
    attachments?: Attachment[],
    options?: { voiceMode?: boolean }
  ): Promise<Message | null> => {
    const text = prompt.trim();
    if (!text && (!attachments || attachments.length === 0)) return null;

    let { activeThreadId } = get();

    // Lazy thread creation on first message
    if (!activeThreadId) {
      activeThreadId = get().createThread('New Chat');
    }

    const thread = get().threads[activeThreadId];
    const model = thread?.model || get().selectedModel || DEFAULT_MODEL_ID;

    const userMessageId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_u_${Date.now()}`;
    const assistantMessageId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_a_${Date.now()}`;

    const userMessage: Message = {
      id: userMessageId,
      threadId: activeThreadId,
      role: 'user',
      content: text,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      status: 'complete',
      createdAt: Date.now(),
    };

    const streamStartTime = Date.now();
    const hasAttachments = Boolean(attachments && attachments.length > 0);
    const initialSteps: ReasoningStep[] = [
      {
        id: 'step-read',
        kind: 'read',
        status: 'running',
        title: hasAttachments ? 'Inspecting attached files' : 'Reading your message',
        detail: hasAttachments
          ? attachments!.map((a) => a.name).join(', ')
          : `${Math.max(1, text.split(/\s+/).length)} words`,
      },
    ];

    const patchAssistantReasoning = (steps: ReasoningStep[], duration?: number) => {
      const currentMsgs = get().messagesByThread[activeThreadId as string] || [];
      const nextMsgs = currentMsgs.map((m) =>
        m.id === assistantMessageId
          ? { ...m, reasoningSteps: steps, reasoningDuration: duration ?? m.reasoningDuration }
          : m
      );
      set((state) => ({
        messagesByThread: {
          ...state.messagesByThread,
          [activeThreadId as string]: nextMsgs,
        },
      }));
    };

    const assistantMessage: Message = {
      id: assistantMessageId,
      threadId: activeThreadId,
      role: 'model',
      content: '',
      modelUsed: model,
      status: 'streaming',
      reasoningSteps: initialSteps,
      createdAt: Date.now() + 1,
    };

    const currentThreadMessages = get().messagesByThread[activeThreadId] || [];
    const nextThreadMessages = [...currentThreadMessages, userMessage, assistantMessage];

    // Persist user message and initial placeholder
    storageAdapter.saveMessages(activeThreadId, nextThreadMessages);

    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [activeThreadId as string]: nextThreadMessages,
      },
      streamingMessageId: assistantMessageId,
    }));

    // Setup abort controller
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    try {
      // Build contents array up to the user message
      const geminiContents = buildGeminiContents([...currentThreadMessages, userMessage]);

      // Advance reasoning timeline while request is in flight
      const step2Start = Date.now();
      const stepTimer = setTimeout(() => {
        patchAssistantReasoning([
          { ...initialSteps[0], status: 'done', duration: Date.now() - streamStartTime },
          {
            id: 'step-analyze',
            kind: 'thought',
            status: 'running',
            title: model.includes('hydrogen') ? 'Reasoning deeply through angles' : 'Analyzing intent & context',
            content: 'Connecting context from the conversation to craft a clear, natural reply.',
          },
        ]);
      }, 280);

      const now = new Date();
      const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const clientLocalTime = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          contents: geminiContents,
          systemInstruction: thread?.systemInstruction,
          voiceMode: Boolean(options?.voiceMode),
          memories: get().memories,
          profile: get().profile,
          clientTimeContext: {
            localFormatted: clientLocalTime,
            timeZone: clientTimeZone,
            iso: now.toISOString(),
          },
        }),
        signal: activeAbortController.signal,
      });

      clearTimeout(stepTimer);

      if (!response.ok) {
        let errDesc = 'Failed to generate response';
        try {
          const errData = await response.json();
          errDesc = errData.error || errDesc;
        } catch {
          errDesc = `Server returned status ${response.status}`;
        }
        patchAssistantReasoning([
          { ...initialSteps[0], status: 'done', duration: Date.now() - streamStartTime },
          { id: 'step-analyze', kind: 'thought', status: 'error', title: 'Request failed', detail: errDesc },
        ], Date.now() - streamStartTime);
        get().finalizeMessage(assistantMessageId, 'error', errDesc);
        return null;
      }

      if (!response.body) {
        get().finalizeMessage(assistantMessageId, 'error', 'No response stream from server');
        return null;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullModelResponse = '';
      let firstChunkAt: number | null = null;
      let streamErrorMessage: string | null = null;

      const patchMessageMeta = (patch: Partial<Message>) => {
        const curr = get().messagesByThread[activeThreadId as string] || [];
        const next = curr.map((m) => (m.id === assistantMessageId ? { ...m, ...patch } : m));
        set((state) => ({
          messagesByThread: {
            ...state.messagesByThread,
            [activeThreadId as string]: next,
          },
        }));
      };

      const processNdjsonLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const evt = JSON.parse(trimmed);
          if (evt.type === 'chunk' && typeof evt.text === 'string') {
            if (firstChunkAt === null) {
              firstChunkAt = Date.now();
              const currMsg = (get().messagesByThread[activeThreadId as string] || []).find(
                (m) => m.id === assistantMessageId
              );
              const existingSteps = currMsg?.reasoningSteps || [
                { ...initialSteps[0], status: 'done', duration: 280 },
              ];
              const finalized = existingSteps.map((s) =>
                s.status === 'running'
                  ? {
                      ...s,
                      status: 'done' as const,
                      duration: s.duration ?? Math.max(120, firstChunkAt! - step2Start),
                    }
                  : s
              );
              if (!finalized.some((s) => s.id === 'step-write')) {
                finalized.push({
                  id: 'step-write',
                  kind: 'write',
                  status: 'running',
                  title: 'Writing response',
                });
              }
              patchAssistantReasoning(finalized);
            }
            fullModelResponse += evt.text;
            get().appendStreamChunk(assistantMessageId, evt.text);
          } else if (evt.type === 'thought_chunk' && typeof evt.text === 'string') {
            const currMsg = (get().messagesByThread[activeThreadId as string] || []).find(
              (m) => m.id === assistantMessageId
            );
            const existingSteps = currMsg?.reasoningSteps || [...initialSteps];
            const hasAnalyze = existingSteps.some((s) => s.id === 'step-analyze');
            const updatedSteps = hasAnalyze
              ? existingSteps.map((s) =>
                  s.id === 'step-analyze'
                    ? { ...s, content: `${s.content ? s.content : ''}${evt.text}` }
                    : s
                )
              : [
                  ...existingSteps.map((s) => ({ ...s, status: 'done' as const })),
                  {
                    id: 'step-analyze',
                    kind: 'thought' as const,
                    status: 'running' as const,
                    title: model.includes('hydrogen')
                      ? 'Reasoning deeply through angles'
                      : 'Analyzing intent & context',
                    content: evt.text,
                  },
                ];
            patchAssistantReasoning(updatedSteps);
          } else if (evt.type === 'tool_step' && evt.step) {
            const incoming = evt.step as ReasoningStep;
            const currMsg = (get().messagesByThread[activeThreadId as string] || []).find(
              (m) => m.id === assistantMessageId
            );
            const baseSteps = (currMsg?.reasoningSteps || [...initialSteps]).map((s) =>
              s.id !== incoming.id && s.status === 'running'
                ? { ...s, status: 'done' as const, duration: s.duration ?? Date.now() - streamStartTime }
                : s
            );
            const idx = baseSteps.findIndex((s) => s.id === incoming.id);
            const nextSteps =
              idx >= 0
                ? baseSteps.map((s, i) => (i === idx ? incoming : s))
                : [...baseSteps, incoming];
            patchAssistantReasoning(nextSteps);
          } else if (evt.type === 'tool_status') {
            patchMessageMeta({ toolStatus: evt.status || undefined });
          } else if (evt.type === 'sources' && Array.isArray(evt.sources)) {
            patchMessageMeta({ sources: evt.sources as GroundingSource[] });
          } else if (evt.type === 'pending_action' && evt.action) {
            patchMessageMeta({ pendingAction: evt.action as PendingEmailAction });
          } else if (evt.type === 'memory_saved' && typeof evt.fact === 'string') {
            get().addMemory(evt.fact);
          } else if (evt.type === 'error' && evt.error) {
            streamErrorMessage = String(evt.error);
          }
        } catch {
          // Ignore malformed JSON control lines; only append genuine plain text fallback
          if (!trimmed.startsWith('{"type":')) {
            fullModelResponse += trimmed;
            get().appendStreamChunk(assistantMessageId, trimmed);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          processNdjsonLine(line);
        }
      }
      if (buffer.trim()) {
        processNdjsonLine(buffer);
      }

      patchMessageMeta({ toolStatus: undefined });

      if (streamErrorMessage && !fullModelResponse) {
        get().finalizeMessage(assistantMessageId, 'error', streamErrorMessage);
        return null;
      }

      const totalDuration = Date.now() - streamStartTime;
      patchAssistantReasoning([
        { ...initialSteps[0], status: 'done', duration: 280 },
        {
          id: 'step-analyze',
          kind: 'thought',
          status: 'done',
          title: model.includes('hydrogen') ? 'Reasoned deeply through angles' : 'Analyzed intent & context',
          duration: firstChunkAt ? Math.max(120, firstChunkAt - step2Start) : 300,
        },
        {
          id: 'step-write',
          kind: 'write',
          status: 'done',
          title: 'Wrote response',
          duration: firstChunkAt ? Math.max(80, Date.now() - firstChunkAt) : 200,
        },
      ], totalDuration);

      get().finalizeMessage(assistantMessageId, 'complete');

      if (get().autoSpeak && !get().voiceModeOpen) {
        const latestMsgs = get().messagesByThread[activeThreadId] || [];
        const completed = latestMsgs.find((m) => m.id === assistantMessageId);
        if (completed?.content?.trim()) {
          get().speakMessage(assistantMessageId, completed.content);
        }
      }

      // Trigger automatic thread title generation if still pending and this is the first turn
      const currentThread = get().threads[activeThreadId];
      if (
        currentThread &&
        (currentThread.titleStatus === 'pending' || currentThread.title === 'New Chat') &&
        currentThreadMessages.length === 0
      ) {
        requestThreadTitle(text, fullModelResponse).then((generatedTitle) => {
          if (generatedTitle) {
            get().renameThread(activeThreadId as string, generatedTitle);
          }
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        get().finalizeMessage(assistantMessageId, 'stopped');
      } else {
        console.error('[useChatStore] Streaming error:', err);
        get().finalizeMessage(
          assistantMessageId,
          'error',
          err.message || 'An unexpected error occurred while communicating with Gemini.'
        );
      }
    } finally {
      activeAbortController = null;
    }

    const finalMessages = get().messagesByThread[activeThreadId] || [];
    return finalMessages.find((m) => m.id === assistantMessageId) || null;
  },

  regenerateMessage: async (targetAssistantMessageId?: string) => {
    const { activeThreadId, messagesByThread } = get();
    if (!activeThreadId) return;

    const messages = messagesByThread[activeThreadId] || [];
    if (messages.length === 0) return;

    // Find target assistant message (default to latest)
    let targetIdx = -1;
    if (targetAssistantMessageId) {
      targetIdx = messages.findIndex((m) => m.id === targetAssistantMessageId);
    } else {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'model') {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) return;

    // Find the preceding user message
    let precedingUserIdx = -1;
    for (let i = targetIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        precedingUserIdx = i;
        break;
      }
    }

    if (precedingUserIdx === -1) return;

    // Reset target assistant message content and set streaming
    const assistantMessageId = messages[targetIdx].id;
    const thread = get().threads[activeThreadId];
    const model = thread?.model || get().selectedModel || DEFAULT_MODEL_ID;

    const updated = messages.map((m, idx) =>
      idx === targetIdx
        ? {
          ...m,
          content: '',
          status: 'streaming' as const,
          modelUsed: model,
          errorMessage: undefined,
        }
        : m
    );

    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [activeThreadId]: updated,
      },
      streamingMessageId: assistantMessageId,
    }));

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    try {
      // Build context up to the user message
      const contextMessages = messages.slice(0, precedingUserIdx + 1);
      const geminiContents = buildGeminiContents(contextMessages);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          contents: geminiContents,
          systemInstruction: thread?.systemInstruction,
        }),
        signal: activeAbortController.signal,
      });

      if (!response.ok) {
        let errDesc = 'Failed to regenerate response';
        try {
          const errData = await response.json();
          errDesc = errData.error || errDesc;
        } catch {
          errDesc = `Server returned status ${response.status}`;
        }
        get().finalizeMessage(assistantMessageId, 'error', errDesc);
        return;
      }

      if (!response.body) {
        get().finalizeMessage(assistantMessageId, 'error', 'No response stream from server');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErrorMessage: string | null = null;
      let hasText = false;

      const patchRegenMeta = (patch: Partial<Message>) => {
        const curr = get().messagesByThread[activeThreadId] || [];
        const next = curr.map((m) => (m.id === assistantMessageId ? { ...m, ...patch } : m));
        set((state) => ({
          messagesByThread: {
            ...state.messagesByThread,
            [activeThreadId]: next,
          },
        }));
      };

      const processRegenLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const evt = JSON.parse(trimmed);
          if (evt.type === 'chunk' && typeof evt.text === 'string') {
            hasText = true;
            get().appendStreamChunk(assistantMessageId, evt.text);
          } else if (evt.type === 'tool_status') {
            patchRegenMeta({ toolStatus: evt.status || undefined });
          } else if (evt.type === 'sources' && Array.isArray(evt.sources)) {
            patchRegenMeta({ sources: evt.sources as GroundingSource[] });
          } else if (evt.type === 'pending_action' && evt.action) {
            patchRegenMeta({ pendingAction: evt.action as PendingEmailAction });
          } else if (evt.type === 'error' && evt.error) {
            streamErrorMessage = String(evt.error);
          }
        } catch {
          if (!trimmed.startsWith('{"type":')) {
            hasText = true;
            get().appendStreamChunk(assistantMessageId, trimmed);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          processRegenLine(line);
        }
      }
      if (buffer.trim()) {
        processRegenLine(buffer);
      }

      patchRegenMeta({ toolStatus: undefined });

      if (streamErrorMessage && !hasText) {
        get().finalizeMessage(assistantMessageId, 'error', streamErrorMessage);
        return;
      }

      get().finalizeMessage(assistantMessageId, 'complete');

      if (get().autoSpeak && !get().voiceModeOpen) {
        const latestMsgs = get().messagesByThread[activeThreadId] || [];
        const completed = latestMsgs.find((m) => m.id === assistantMessageId);
        if (completed?.content?.trim()) {
          get().speakMessage(assistantMessageId, completed.content);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        get().finalizeMessage(assistantMessageId, 'stopped');
      } else {
        console.error('[useChatStore] Regenerate streaming error:', err);
        get().finalizeMessage(
          assistantMessageId,
          'error',
          err.message || 'An unexpected error occurred while regenerating response.'
        );
      }
    } finally {
      activeAbortController = null;
    }
  },
}));
