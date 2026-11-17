'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  AudioLines,
  User,
  Sun,
  Moon,
  Sparkles,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { unlockSpeechSynthesis } from '../utils/speechOutput';

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    threads,
    threadOrder,
    setActiveThread,
    createThread,
    setVoiceModeOpen,
    setProfileModalOpen,
    theme,
    toggleTheme,
    selectedModel,
    setSelectedModel,
    sendMessage,
  } = useChatStore();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [commandPaletteOpen]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actions = [
      {
        id: 'new-chat',
        label: 'New chat',
        hint: 'Start a fresh conversation',
        icon: <Plus className="w-4 h-4" strokeWidth={1.5} />,
        run: () => createThread(),
      },
      {
        id: 'briefing',
        label: 'Morning briefing',
        hint: 'Check unread emails, today’s calendar & tasks',
        icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} />,
        run: () => {
          void sendMessage(
            'Give me my morning briefing: check my unread emails, today’s Google Calendar events, and my pending Google Tasks.'
          );
        },
      },
      {
        id: 'voice-mode',
        label: 'Start Jasmine live voice',
        hint: 'Hands-free spoken conversation',
        icon: <AudioLines className="w-4 h-4" strokeWidth={1.5} />,
        run: () => {
          unlockSpeechSynthesis();
          setVoiceModeOpen(true);
        },
      },
      {
        id: 'profile-memory',
        label: 'Profile & personal memory',
        hint: 'Edit profile card and saved facts',
        icon: <User className="w-4 h-4" strokeWidth={1.5} />,
        run: () => setProfileModalOpen(true),
      },
      {
        id: 'toggle-model',
        label:
          selectedModel === 'gemini-4-hydrogen'
            ? 'Switch to Fast model (Gemini 3.5 Flash Lite)'
            : 'Switch to Deep Reasoning (Gemini 4 Hydrogen)',
        hint: 'Toggle speed vs deep reasoning',
        icon: <Zap className="w-4 h-4" strokeWidth={1.5} />,
        run: () =>
          setSelectedModel(
            selectedModel === 'gemini-4-hydrogen'
              ? 'gemini-3.5-flash-lite'
              : 'gemini-4-hydrogen'
          ),
      },
      {
        id: 'toggle-theme',
        label: theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme',
        hint: 'Toggle appearance',
        icon: theme === 'dark' ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />,
        run: () => toggleTheme(),
      },
    ];

    const threadItems = threadOrder
      .map((id) => threads[id])
      .filter(Boolean)
      .slice(0, 12)
      .map((t) => ({
        id: `thread-${t.id}`,
        label: t.title,
        hint: 'Jump to conversation',
        icon: <MessageSquare className="w-4 h-4" strokeWidth={1.5} />,
        run: () => setActiveThread(t.id),
      }));

    const combined = [...actions, ...threadItems];
    if (!q) return combined;
    return combined.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
    );
  }, [
    query,
    threads,
    threadOrder,
    selectedModel,
    theme,
    createThread,
    sendMessage,
    setVoiceModeOpen,
    setProfileModalOpen,
    setSelectedModel,
    toggleTheme,
    setActiveThread,
  ]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      items[activeIndex].run();
      setCommandPaletteOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[var(--j-surface)] border border-[var(--j-border)] shadow-2xl overflow-hidden text-[var(--j-text)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[var(--j-border)]">
          <Search className="w-4 h-4 text-[var(--j-text-muted)]" strokeWidth={1.5} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command or search chats..."
            className="flex-1 bg-transparent text-sm text-[var(--j-text)] placeholder:text-[var(--j-text-muted)] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--j-bg)] border border-[var(--j-border)] text-[10px] font-mono text-[var(--j-text-muted)]">
            Esc
          </kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {items.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-[var(--j-text-muted)]">
              No matching commands or conversations
            </li>
          ) : (
            items.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    item.run();
                    setCommandPaletteOpen(false);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    idx === activeIndex
                      ? 'bg-[var(--j-surface-hover)] text-[var(--j-text)]'
                      : 'text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-alt)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[var(--j-text-muted)] shrink-0">{item.icon}</span>
                    <span className="text-xs font-medium truncate">{item.label}</span>
                  </div>
                  <span className="text-[11px] text-[var(--j-text-muted)] shrink-0 hidden sm:inline">
                    {item.hint}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
