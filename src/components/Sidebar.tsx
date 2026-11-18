'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import {
  Plus,
  Search,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  X,
  PanelLeftClose,
  MoreHorizontal,
  Pin,
} from 'lucide-react';
import { ChatThread } from '../types/chat';
import { JasmineIcon } from './JasmineLogo';

function groupThreadsByDate(threads: ChatThread[]): Record<string, ChatThread[]> {
  const groups: Record<string, ChatThread[]> = {
    Pinned: [],
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const lastWeekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  for (const t of threads) {
    if (t.pinned) {
      groups.Pinned.push(t);
      continue;
    }
    const time = t.updatedAt || t.createdAt;
    if (time >= todayStart) {
      groups.Today.push(t);
    } else if (time >= yesterdayStart) {
      groups.Yesterday.push(t);
    } else if (time >= lastWeekStart) {
      groups['Previous 7 days'].push(t);
    } else {
      groups.Older.push(t);
    }
  }

  return groups;
}

export function Sidebar() {
  const {
    threads,
    threadOrder,
    activeThreadId,
    setActiveThread,
    renameThread,
    togglePinThread,
    deleteThread,
    searchQuery,
    setSearchQuery,
    sidebarOpen,
    setSidebarOpen,
  } = useChatStore();

  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const orderedThreads = threadOrder
    .map((id) => threads[id])
    .filter((t): t is ChatThread => Boolean(t));

  const filteredThreads = searchQuery.trim()
    ? orderedThreads.filter((t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : orderedThreads;

  const grouped = groupThreadsByDate(filteredThreads);

  const handleStartRename = (t: ChatThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setEditingThreadId(t.id);
    setEditTitleValue(t.title);
  };

  const handleSaveRename = (threadId: string) => {
    if (editTitleValue.trim()) {
      renameThread(threadId, editTitleValue.trim());
    }
    setEditingThreadId(null);
  };

  const handleKeyDownRename = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(threadId);
    } else if (e.key === 'Escape') {
      setEditingThreadId(null);
    }
  };

  const handlePin = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    togglePinThread(threadId);
  };

  const handleDelete = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    deleteThread(threadId);
  };

  const handleNewChat = () => {
    setActiveThread(null);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 shrink-0 overflow-hidden bg-[var(--j-surface-glass)] backdrop-blur-md border-r border-[#1E3A8A]/20 dark:border-[#93C5FD]/20 transition-all duration-200 ease-in-out select-none ${
          sidebarOpen
            ? 'w-[260px] translate-x-0 opacity-100'
            : 'w-[260px] -translate-x-full pointer-events-none md:translate-x-0 md:w-0 md:opacity-0 md:border-r-0'
        }`}
      >
        <div className="w-[260px] h-full flex flex-col">
        {/* Top Action Bar */}
        <div className="p-3 border-b border-[#1E3A8A]/15 dark:border-[#93C5FD]/15 flex items-center justify-between gap-2">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E3A8A] hover:from-[#1D4ED8] hover:to-[#1E3A8A] text-white text-xs font-semibold shadow-md shadow-blue-600/20 border border-[#93C5FD]/25 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>New chat</span>
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse sidebar"
            className="p-2 rounded-lg text-[var(--j-text-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)] transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Search Filter */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--j-text-muted)]" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-7 bg-[var(--j-surface)] border border-[var(--j-border)] rounded-lg text-xs text-[var(--j-text)] placeholder-[var(--j-text-muted)] focus:outline-none focus:border-[var(--j-border-strong)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--j-text-muted)] hover:text-[var(--j-text)]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Chronological Thread List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
          {filteredThreads.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-[var(--j-text-muted)]">
              {searchQuery ? 'No matching threads' : 'No conversations yet'}
            </div>
          ) : (
            Object.entries(grouped).map(([label, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={label} className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--j-text-muted)]">
                    {label}
                  </div>
                  {items.map((t) => {
                    const isActive = t.id === activeThreadId;
                    const isEditing = editingThreadId === t.id;
                    const isMenuOpen = openMenuId === t.id;

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (!isEditing) {
                            setActiveThread(t.id);
                            if (window.innerWidth < 768) {
                              setSidebarOpen(false);
                            }
                          }
                        }}
                        className={`group relative flex items-center justify-between gap-2 px-3 h-9 md:h-8 rounded-xl text-xs cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#2563EB]/10 dark:bg-[#2563EB]/20 text-[var(--j-text)] font-medium border border-[#2563EB]/30 shadow-sm'
                            : 'text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-alt)] hover:text-[var(--j-text)]'
                        }`}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#2563EB]"
                          />
                        )}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {t.pinned ? (
                            <Pin
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? 'text-[var(--j-accent)]' : 'text-[var(--j-text-muted)]'
                              }`}
                            />
                          ) : (
                            <MessageSquare
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? 'text-[var(--j-accent)]' : 'text-[var(--j-text-muted)]'
                              }`}
                            />
                          )}

                          {isEditing ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                type="text"
                                value={editTitleValue}
                                onChange={(e) => setEditTitleValue(e.target.value)}
                                onKeyDown={(e) => handleKeyDownRename(e, t.id)}
                                onBlur={() => handleSaveRename(t.id)}
                                className="w-full bg-[var(--j-surface)] border border-[var(--j-accent)] rounded px-1.5 py-0.5 text-xs text-[var(--j-text)] focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveRename(t.id)}
                                className="p-0.5 text-[var(--j-accent)] hover:text-[var(--j-text)]"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingThreadId(null)}
                                className="p-0.5 text-[var(--j-text-muted)] hover:text-[var(--j-text)]"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="truncate flex-1"
                              title={t.title}
                            >
                              {t.title}
                            </span>
                          )}
                        </div>

                        {/* ⋯ Menu trigger */}
                        {!isEditing && (
                          <div className="relative shrink-0" ref={isMenuOpen ? menuRef : undefined}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : t.id);
                              }}
                              aria-label="Chat options"
                              className={`p-1.5 md:p-1 rounded text-[var(--j-text-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-hover)] transition-colors ${
                                isMenuOpen ? 'opacity-100' : 'opacity-80 md:opacity-0 md:group-hover:opacity-100'
                              }`}
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-7 w-36 rounded-lg bg-[var(--j-surface)] border border-[var(--j-border-strong)] p-1 shadow-xl z-50"
                              >
                                <button
                                  onClick={(e) => handlePin(t.id, e)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-alt)] hover:text-[var(--j-text)] transition-colors"
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                  <span>{t.pinned ? 'Unpin' : 'Pin'}</span>
                                </button>
                                <button
                                  onClick={(e) => handleStartRename(t, e)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-alt)] hover:text-[var(--j-text)] transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  onClick={(e) => handleDelete(t.id, e)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-alt)] hover:text-[var(--j-text)] transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Quiet Footer */}
        <div className="p-3 border-t border-[var(--j-border)] flex items-center gap-2 text-[11px] text-[var(--j-text-muted)]">
          <JasmineIcon size={14} />
          <span>Jasmine</span>
        </div>
        </div>
      </aside>
    </>
  );
}
