'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useChatStore } from '../store/useChatStore';
import { AVAILABLE_MODELS } from '../types/chat';
import { PanelLeft, ChevronDown, Check, Sun, Moon, Mail, LogOut, Volume2, VolumeX, User, Command } from 'lucide-react';
import { JasmineIcon } from './JasmineLogo';
import { unlockSpeechSynthesis } from '../utils/speechOutput';

export function TopBar() {
  const { data: session, status: sessionStatus } = useSession();
  const {
    sidebarOpen,
    toggleSidebar,
    selectedModel,
    setSelectedModel,
    threads,
    activeThreadId,
    theme,
    toggleTheme,
    autoSpeak,
    toggleAutoSpeak,
    setProfileModalOpen,
    setCommandPaletteOpen,
  } = useChatStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentThread = activeThreadId ? threads[activeThreadId] : null;
  const currentModelId = currentThread?.model || selectedModel;
  const currentModelOption =
    AVAILABLE_MODELS.find((m) => m.id === currentModelId) || AVAILABLE_MODELS[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isWorkspaceConnected = Boolean(session?.hasWorkspaceAccess);
  const workspaceScopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/tasks',
  ].join(' ');

  return (
    <header className="h-[52px] shrink-0 bg-[var(--j-bg)]/90 backdrop-blur-md border-b border-[var(--j-border)] px-3 sm:px-4 flex items-center justify-between gap-2 select-none z-30">
      {/* Left: Sidebar Toggle & Brand */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          className="p-2 sm:p-1.5 rounded-lg text-[var(--j-text-secondary)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)] transition-colors shrink-0"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <JasmineIcon size={20} />
          <span className="text-sm font-medium tracking-tight text-[var(--j-text)] truncate">
            Jasmine
          </span>
        </div>
      </div>

      {/* Right: Command Palette, Profile & Memory, Google Workspace Connect, Theme Toggle & Model Selector */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          title="Command Palette (Ctrl+K)"
          aria-label="Open Command Palette"
          className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[var(--j-surface)] hover:bg-[var(--j-surface-hover)] text-[var(--j-text-secondary)] hover:text-[var(--j-text)] text-xs border border-[var(--j-border)] transition-colors"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px] text-[var(--j-text-muted)]">Ctrl K</span>
        </button>

        <button
          onClick={() => setProfileModalOpen(true)}
          title="Profile & Memory"
          aria-label="Profile and Memory"
          className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg bg-[var(--j-surface)] hover:bg-[var(--j-surface-hover)] text-[var(--j-text)] text-xs border border-[var(--j-border)] transition-colors"
        >
          <User className="w-3.5 h-3.5 text-[var(--j-accent)]" />
          <span className="hidden md:inline">Memory</span>
        </button>
        {sessionStatus !== 'loading' && (
          <div className="flex items-center gap-1.5">
            {!isWorkspaceConnected && (
              <button
                onClick={() =>
                  signIn(
                    'google',
                    { callbackUrl: '/' },
                    {
                      scope: workspaceScopes,
                      access_type: 'offline',
                      prompt: 'consent',
                    }
                  )
                }
                title="Connect Gmail, Calendar, Drive & Tasks"
                className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg bg-[var(--j-surface)] hover:bg-[var(--j-surface-hover)] text-[var(--j-text)] text-xs font-medium border border-[var(--j-border)] transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[var(--j-accent)]" />
                <span className="hidden sm:inline">Connect Workspace</span>
              </button>
            )}
            {session?.user && (
              <div className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg bg-[var(--j-surface)] border border-[var(--j-border)] text-xs text-[var(--j-text)]">
                {isWorkspaceConnected && (
                  <Mail className="w-3.5 h-3.5 text-[var(--j-accent)] shrink-0" />
                )}
                <span className="hidden sm:inline truncate max-w-[140px]">
                  {session.user.email || session.user.name || 'Signed in'}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-0.5 rounded text-[var(--j-text-muted)] hover:text-[var(--j-text)] transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => {
            unlockSpeechSynthesis();
            toggleAutoSpeak();
          }}
          aria-label={autoSpeak ? 'Mute auto-read responses' : 'Enable auto-read responses'}
          className={`p-2 sm:p-1.5 rounded-lg border transition-colors ${autoSpeak
              ? 'bg-[var(--j-surface-alt)] border-[var(--j-border-strong)] text-[var(--j-accent)]'
              : 'bg-[var(--j-surface)] hover:bg-[var(--j-surface-hover)] border-[var(--j-border)] text-[var(--j-text-muted)] hover:text-[var(--j-text)]'
            }`}
          title={autoSpeak ? 'Auto-read aloud: On' : 'Auto-read aloud: Off'}
        >
          {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="p-2 sm:p-1.5 rounded-lg bg-[var(--j-surface)] hover:bg-[var(--j-surface-hover)] text-[var(--j-text-secondary)] hover:text-[var(--j-text)] border border-[var(--j-border)] transition-colors"
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 h-8 px-2.5 sm:px-3 rounded-lg bg-[var(--j-surface)] hover:bg-[var(--j-surface-hover)] text-[var(--j-text)] text-xs font-medium border border-[var(--j-border)] transition-colors"
          >
            <span className="truncate max-w-[96px] sm:max-w-none">{currentModelOption.name}</span>
            <span className="hidden sm:inline text-[11px] text-[var(--j-text-muted)]">
              {currentModelOption.badge}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--j-text-muted)] shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-[var(--j-surface)] border border-[var(--j-border-strong)] p-1.5 shadow-xl z-50">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--j-text-muted)]">
                Model
              </div>
              <div className="space-y-1">
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = model.id === currentModelOption.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start justify-between gap-2 text-xs transition-colors ${isSelected
                          ? 'bg-[var(--j-surface-hover)] text-[var(--j-text)]'
                          : 'text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-alt)] hover:text-[var(--j-text)]'
                        }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          <span>{model.name}</span>
                          <span className="text-[11px] text-[var(--j-text-muted)] font-normal">
                            {model.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--j-text-muted)] leading-relaxed">
                          {model.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[var(--j-accent)] shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
