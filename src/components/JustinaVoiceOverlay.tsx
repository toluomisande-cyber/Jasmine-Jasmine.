'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  X,
  SkipForward,
  Captions,
  Volume2,
  Mail,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useJustinaVoice } from '../hooks/useJustinaVoice';
import { useChatStore } from '../store/useChatStore';

function formatElapsed(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function JustinaVoiceOverlay() {
  const {
    voiceModeOpen,
    setVoiceModeOpen,
    activeThreadId,
    messagesByThread,
    updatePendingEmailStatus,
  } = useChatStore();

  const {
    orbState,
    micLevel,
    muted,
    ttsSupported,
    userCaption,
    justinaCaption,
    errorMessage,
    liveToolStatus,
    toggleMute,
    interruptSpeech,
    replayLastSpeech,
    testVoice,
  } = useJustinaVoice(voiceModeOpen);

  const [showTranscript, setShowTranscript] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed session timer
  useEffect(() => {
    if (!voiceModeOpen) {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [voiceModeOpen]);

  // Spacebar barge-in / interrupt while Jasmine is speaking, Esc to close
  useEffect(() => {
    if (!voiceModeOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && orbState === 'speaking') {
        e.preventDefault();
        interruptSpeech();
      } else if (e.code === 'Escape') {
        setVoiceModeOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [voiceModeOpen, orbState, interruptSpeech, setVoiceModeOpen]);

  if (!voiceModeOpen) return null;

  const threadMessages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];
  const latestMsg = threadMessages[threadMessages.length - 1];
  const pendingEmail =
    latestMsg?.role === 'model' && latestMsg.pendingAction?.status === 'pending'
      ? { messageId: latestMsg.id, action: latestMsg.pendingAction }
      : null;

  const handleApproveVoiceEmail = async () => {
    if (!pendingEmail || !activeThreadId) return;
    setSendingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingEmail.action.payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      updatePendingEmailStatus(activeThreadId, pendingEmail.messageId, 'sent');
    } catch (err: any) {
      setEmailError(err?.message || 'Unable to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelVoiceEmail = () => {
    if (!pendingEmail || !activeThreadId) return;
    updatePendingEmailStatus(activeThreadId, pendingEmail.messageId, 'cancelled');
  };

  const statusText =
    orbState === 'error'
      ? 'Microphone unavailable'
      : orbState === 'thinking'
        ? liveToolStatus || 'Checking context'
        : orbState === 'speaking'
          ? 'Speaking'
          : muted
            ? 'Microphone muted'
            : 'Listening';

  const indicatorColor =
    orbState === 'error'
      ? '#e5484d'
      : orbState === 'thinking'
        ? '#d97706'
        : orbState === 'speaking'
          ? '#4cc38a'
          : muted
            ? '#7a8296'
            : '#2563eb';

  const orbScale =
    orbState === 'listening' && !muted
      ? 1 + micLevel * 0.28
      : orbState === 'speaking'
        ? 1.08
        : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#07080d] text-[#eef0f5] p-6 select-none justina-overlay-in"
      role="dialog"
      aria-modal="true"
      aria-label="Jasmine Voice Session"
    >
      {/* Top Bar */}
      <header className="h-14 max-w-3xl w-full mx-auto flex items-center justify-between gap-4 border-b border-[#eef0f5]/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0 transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ backgroundColor: indicatorColor }}
          />
          <span className="text-sm font-medium text-[#eef0f5] truncate">Jasmine</span>
          <span className="text-xs text-[#7a8296] hidden sm:inline">Live · Aoede</span>
          <span className="text-xs font-mono tabular-nums text-[#7a8296] pl-2 border-l border-[#eef0f5]/[0.08]">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testVoice}
            disabled={!ttsSupported}
            aria-label="Test voice audio"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[#11141c] hover:bg-[#1a1e28] border border-[#eef0f5]/[0.08] hover:border-[#eef0f5]/[0.16] text-[13px] font-medium text-[#eef0f5] disabled:opacity-40 transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <Volume2 className="w-4 h-4 text-[#a3a9b8]" strokeWidth={1.5} />
            <span>Test voice</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTranscript((prev) => !prev)}
            aria-label={showTranscript ? 'Hide transcript' : 'Show transcript'}
            aria-pressed={showTranscript}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
              showTranscript
                ? 'bg-[#1a1e28] border-[#eef0f5]/[0.16] text-[#eef0f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-[#11141c] border-[#eef0f5]/[0.08] text-[#a3a9b8] hover:bg-[#1a1e28] hover:text-[#eef0f5]'
            }`}
          >
            <Captions className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Transcript</span>
          </button>
        </div>
      </header>

      {/* Center Stage: Glowing Voice Orb + Status + Optional Email Draft */}
      <main className="flex-1 flex flex-col items-center justify-center gap-6 max-w-lg w-full mx-auto py-6">
        {errorMessage ? (
          <div className="w-full rounded-2xl bg-[#11141c] border border-[#e5484d]/30 p-6 text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-[#e5484d] text-sm font-medium">
              <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
              <span>Voice session blocked</span>
            </div>
            <p className="text-[13px] text-[#a3a9b8] leading-5">{errorMessage}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (orbState === 'speaking') interruptSpeech();
            }}
            aria-label={orbState === 'speaking' ? 'Interrupt Jasmine' : 'Jasmine glowing voice orb'}
            className="relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] group"
          >
            {/* Outer Ambient Glow Halo */}
            <span
              style={{ transform: `scale(${orbScale * 1.18})` }}
              className={`absolute inset-0 rounded-full blur-2xl transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                orbState === 'thinking'
                  ? 'bg-amber-500/35'
                  : orbState === 'speaking'
                    ? 'bg-gradient-to-tr from-emerald-500/40 to-violet-500/40'
                    : muted
                      ? 'bg-zinc-600/15'
                      : 'bg-[#2563EB]/35'
              }`}
            />

            {/* Spinning Ring for Thinking State */}
            {orbState === 'thinking' && (
              <span className="absolute inset-3 rounded-full border-2 border-dashed border-amber-400/70 animate-spin" />
            )}

            {/* Speaking Wave Ring */}
            {orbState === 'speaking' && (
              <span className="absolute inset-2 rounded-full border-2 border-emerald-400/50 animate-ping" />
            )}

            {/* Core Audio-Reactive Glowing Orb */}
            <div
              style={{ transform: `scale(${orbScale})` }}
              className={`relative w-32 h-32 sm:w-36 sm:h-36 rounded-full shadow-2xl transition-transform duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center border ${
                orbState === 'thinking'
                  ? 'bg-gradient-to-br from-amber-400 via-amber-600 to-orange-700 border-amber-300/50 shadow-[0_0_48px_rgba(245,158,11,0.45)]'
                  : orbState === 'speaking'
                    ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-600 border-emerald-200/50 shadow-[0_0_52px_rgba(52,211,153,0.45)]'
                    : muted
                      ? 'bg-gradient-to-br from-zinc-700 to-zinc-900 border-zinc-600/50'
                      : 'bg-gradient-to-br from-[#93C5FD] via-[#2563EB] to-[#1E3A8A] border-[#93C5FD]/50 shadow-[0_0_48px_rgba(37,99,235,0.5)]'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                {orbState === 'thinking' ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" strokeWidth={1.5} />
                ) : muted ? (
                  <MicOff className="w-6 h-6 text-white/80" strokeWidth={1.5} />
                ) : (
                  <Mic className="w-6 h-6 text-white" strokeWidth={1.5} />
                )}
              </div>
            </div>
          </button>
        )}

        {/* Status Readout + Keycap Signature */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 text-sm font-medium text-[#eef0f5]">
            <span>{statusText}</span>
            {orbState === 'thinking' && (
              <Loader2 className="w-4 h-4 text-[#d97706] animate-spin" strokeWidth={1.5} />
            )}
          </div>
          {orbState === 'speaking' ? (
            <p className="text-xs text-[#7a8296] flex items-center gap-1.5">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1a1e28] border border-[#eef0f5]/[0.1] font-mono text-[11px] text-[#a3a9b8]">
                Space
              </kbd>
              <span>to interrupt</span>
            </p>
          ) : (
            <p className="text-xs text-[#7a8296] flex items-center gap-1.5">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1a1e28] border border-[#eef0f5]/[0.1] font-mono text-[11px] text-[#a3a9b8]">
                Esc
              </kbd>
              <span>to exit</span>
            </p>
          )}
        </div>

        {/* Pending Email Confirmation Card */}
        {pendingEmail && activeThreadId && (
          <div className="w-full rounded-2xl bg-[#11141c] border border-[#eef0f5]/[0.1] p-4 space-y-3 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium text-[#eef0f5]">
                <Mail className="w-4 h-4 text-[#a3a9b8]" strokeWidth={1.5} />
                <span>Confirm email draft</span>
              </div>
              <span className="text-xs text-[#7a8296]">Awaiting approval</span>
            </div>

            <div className="space-y-1.5 text-xs border-t border-[#eef0f5]/[0.08] pt-3">
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-[#7a8296]">To</span>
                <span className="text-[#eef0f5] truncate">{pendingEmail.action.payload.to}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-[#7a8296]">Subject</span>
                <span className="text-[#eef0f5] truncate">{pendingEmail.action.payload.subject}</span>
              </div>
              <p className="text-[#a3a9b8] line-clamp-2 pt-1 leading-5">
                {pendingEmail.action.payload.body}
              </p>
            </div>

            {emailError && <p className="text-xs text-[#e5484d]">{emailError}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleApproveVoiceEmail}
                disabled={sendingEmail}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-[#eef0f5] text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                {sendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Send className="w-4 h-4" strokeWidth={1.5} />
                )}
                <span>{sendingEmail ? 'Sending' : 'Approve & send'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancelVoiceEmail}
                disabled={sendingEmail}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[#1a1e28] hover:bg-[#232836] border border-[#eef0f5]/[0.08] text-[#a3a9b8] hover:text-[#eef0f5] text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Dock: Live Transcript + Controls */}
      <footer className="max-w-2xl w-full mx-auto space-y-4 pb-[env(safe-area-inset-bottom)]">
        {showTranscript && (userCaption || justinaCaption) && (
          <div className="rounded-2xl bg-[#11141c] border border-[#eef0f5]/[0.08] p-4 space-y-2 text-[13px] leading-5 max-h-36 overflow-y-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {userCaption && (
              <div className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 text-xs font-medium text-[#7a8296]">You</span>
                <p className="text-[#eef0f5] min-w-0">{userCaption}</p>
              </div>
            )}
            {justinaCaption && (
              <div className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 text-xs font-medium text-[#4cc38a]">Jasmine</span>
                <p className="text-[#a3a9b8] min-w-0">{justinaCaption}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 p-2 rounded-2xl bg-[#11141c] border border-[#eef0f5]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                muted
                  ? 'bg-[#e5484d]/15 border border-[#e5484d]/30 text-[#eef0f5]'
                  : 'bg-[#1a1e28] hover:bg-[#232836] border border-[#eef0f5]/[0.08] text-[#eef0f5]'
              }`}
            >
              {muted ? (
                <MicOff className="w-4 h-4 text-[#e5484d]" strokeWidth={1.5} />
              ) : (
                <Mic className="w-4 h-4 text-[#a3a9b8]" strokeWidth={1.5} />
              )}
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>

            {orbState === 'speaking' ? (
              <button
                type="button"
                onClick={interruptSpeech}
                aria-label="Interrupt speech"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#1a1e28] hover:bg-[#232836] border border-[#eef0f5]/[0.08] text-[#eef0f5] text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                <SkipForward className="w-4 h-4 text-[#a3a9b8]" strokeWidth={1.5} />
                <span>Interrupt</span>
              </button>
            ) : justinaCaption ? (
              <button
                type="button"
                onClick={replayLastSpeech}
                aria-label="Replay last reply"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#1a1e28] hover:bg-[#232836] border border-[#eef0f5]/[0.08] text-[#eef0f5] text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                <Volume2 className="w-4 h-4 text-[#a3a9b8]" strokeWidth={1.5} />
                <span>Replay</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setVoiceModeOpen(false)}
              aria-label="End voice session"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#e5484d] hover:bg-[#dc2626] text-[#eef0f5] text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5484d]"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
              <span>End</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
