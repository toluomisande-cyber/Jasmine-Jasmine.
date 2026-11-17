import { ChatThread, Message, DEFAULT_MODEL_ID } from '../types/chat';

const STORAGE_KEYS = {
  THREADS: 'jasmine_chat_threads',
  THREAD_ORDER: 'jasmine_chat_thread_order',
  MESSAGES_PREFIX: 'jasmine_chat_messages_',
  DEFAULT_MODEL: 'jasmine_chat_default_model',
  SIDEBAR_OPEN: 'jasmine_chat_sidebar_open',
  ACTIVE_THREAD_ID: 'jasmine_chat_active_thread_id',
  THEME: 'jasmine_chat_theme',
  AUTO_SPEAK: 'jasmine_chat_auto_speak',
};

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const storageAdapter = {
  loadThreads(): { threads: Record<string, ChatThread>; threadOrder: string[] } {
    if (!isClient()) {
      return { threads: {}, threadOrder: [] };
    }
    try {
      const rawThreads = localStorage.getItem(STORAGE_KEYS.THREADS);
      const rawOrder = localStorage.getItem(STORAGE_KEYS.THREAD_ORDER);
      const threads = rawThreads ? (JSON.parse(rawThreads) as Record<string, ChatThread>) : {};
      const threadOrder = rawOrder ? (JSON.parse(rawOrder) as string[]) : Object.keys(threads);
      return { threads, threadOrder };
    } catch (err) {
      console.error('[storageAdapter] Failed to load threads:', err);
      return { threads: {}, threadOrder: [] };
    }
  },

  saveThreads(threads: Record<string, ChatThread>, threadOrder: string[]): void {
    if (!isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(threads));
      localStorage.setItem(STORAGE_KEYS.THREAD_ORDER, JSON.stringify(threadOrder));
    } catch (err) {
      console.error('[storageAdapter] Failed to save threads:', err);
    }
  },

  loadMessages(threadId: string): Message[] {
    if (!isClient() || !threadId) return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${threadId}`);
      if (!raw) return [];
      return JSON.parse(raw) as Message[];
    } catch (err) {
      console.error(`[storageAdapter] Failed to load messages for thread ${threadId}:`, err);
      return [];
    }
  },

  saveMessages(threadId: string, messages: Message[]): void {
    if (!isClient() || !threadId) return;
    try {
      // Do not store actively streaming states to localStorage; sanitize them
      const sanitized = messages.map((m) =>
        m.status === 'streaming' ? { ...m, status: 'stopped' as const } : m
      );
      localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${threadId}`, JSON.stringify(sanitized));
    } catch (err) {
      console.error(`[storageAdapter] Failed to save messages for thread ${threadId}:`, err);
    }
  },

  deleteThreadStorage(threadId: string): void {
    if (!isClient() || !threadId) return;
    try {
      localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${threadId}`);
    } catch (err) {
      console.error(`[storageAdapter] Failed to delete messages for thread ${threadId}:`, err);
    }
  },

  loadDefaultModel(): string {
    if (!isClient()) return DEFAULT_MODEL_ID;
    try {
      return localStorage.getItem(STORAGE_KEYS.DEFAULT_MODEL) || DEFAULT_MODEL_ID;
    } catch {
      return DEFAULT_MODEL_ID;
    }
  },

  saveDefaultModel(modelId: string): void {
    if (!isClient() || !modelId) return;
    try {
      localStorage.setItem(STORAGE_KEYS.DEFAULT_MODEL, modelId);
    } catch (err) {
      console.error('[storageAdapter] Failed to save default model:', err);
    }
  },

  loadSidebarState(): boolean {
    if (!isClient()) return true;
    try {
      const val = localStorage.getItem(STORAGE_KEYS.SIDEBAR_OPEN);
      if (val === null) {
        return window.innerWidth >= 768;
      }
      return val === 'true';
    } catch {
      return true;
    }
  },

  saveSidebarState(open: boolean): void {
    if (!isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_OPEN, String(open));
    } catch (err) {
      console.error('[storageAdapter] Failed to save sidebar state:', err);
    }
  },

  loadActiveThreadId(): string | null {
    if (!isClient()) return null;
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_THREAD_ID) || null;
    } catch {
      return null;
    }
  },

  saveActiveThreadId(threadId: string | null): void {
    if (!isClient()) return;
    try {
      if (threadId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_THREAD_ID, threadId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_THREAD_ID);
      }
    } catch (err) {
      console.error('[storageAdapter] Failed to save active thread id:', err);
    }
  },

  loadTheme(): 'light' | 'dark' {
    if (!isClient()) return 'light';
    try {
      const val = localStorage.getItem(STORAGE_KEYS.THEME);
      return val === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  },

  saveTheme(theme: 'light' | 'dark'): void {
    if (!isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (err) {
      console.error('[storageAdapter] Failed to save theme:', err);
    }
  },

  loadAutoSpeak(): boolean {
    if (!isClient()) return true;
    try {
      const val = localStorage.getItem(STORAGE_KEYS.AUTO_SPEAK);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  },

  saveAutoSpeak(enabled: boolean): void {
    if (!isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_SPEAK, String(enabled));
    } catch (err) {
      console.error('[storageAdapter] Failed to save auto-speak:', err);
    }
  },
};
