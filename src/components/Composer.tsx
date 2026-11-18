'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Attachment } from '../types/chat';
import { processFileForAttachment, isAllowedFileType } from '../utils/uploadAttachment';
import { unlockSpeechSynthesis } from '../utils/speechOutput';
import {
  ArrowUp,
  Square,
  Plus,
  X,
  FileText,
  Music,
  Image as ImageIcon,
  Loader2,
  AudioLines,
  Zap,
  Sparkles,
} from 'lucide-react';

const SLASH_COMMANDS = [
  {
    cmd: '/briefing',
    label: 'Morning briefing',
    desc: 'Unread emails, today’s calendar & pending tasks',
    template:
      'Give me my morning briefing: check my unread emails, today’s Google Calendar events, and my pending Google Tasks.',
    autoSend: true,
  },
  {
    cmd: '/summarize',
    label: 'Summarize',
    desc: 'Summarize a URL, article, or attached PDF',
    template: 'Summarize this clearly with key takeaways: ',
    autoSend: false,
  },
  {
    cmd: '/reply',
    label: 'Draft email reply',
    desc: 'Prepare a concise email draft with Approve & Send',
    template: 'Draft an email reply to ',
    autoSend: false,
  },
  {
    cmd: '/schedule',
    label: 'Schedule event',
    desc: 'Check calendar availability & create an event',
    template: 'Check my Google Calendar and schedule ',
    autoSend: false,
  },
  {
    cmd: '/task',
    label: 'Add Google Task',
    desc: 'Add an item to your Google Tasks list',
    template: 'Add a Google Task: ',
    autoSend: false,
  },
  {
    cmd: '/remember',
    label: 'Save to memory',
    desc: 'Remember a preference or personal fact',
    template: 'Remember this about me: ',
    autoSend: false,
  },
];

interface PendingAttachment {
  file: File;
  attachment?: Attachment;
  uploading: boolean;
  progress: number;
  error?: string;
}

export function Composer() {
  const {
    sendMessage,
    stopStreaming,
    streamingMessageId,
    setVoiceModeOpen,
    activeThreadId,
    messagesByThread,
    selectedModel,
    setSelectedModel,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStreaming = Boolean(streamingMessageId);

  const threadMessages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];
  const totalChars =
    threadMessages.reduce((acc, m) => acc + (m.content?.length || 0), 0) + input.length;
  const estimatedTokens = Math.max(0, Math.round(totalChars / 4));
  const isDeepModel = selectedModel === 'gemini-4-hydrogen';

  const slashQuery = input.startsWith('/') && !input.includes(' ') ? input.toLowerCase() : null;
  const filteredCommands =
    slashQuery !== null
      ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery))
      : [];
  const showSlashMenu = filteredCommands.length > 0;

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(isAllowedFileType);
    if (fileArray.length === 0) return;

    const newPending: PendingAttachment[] = fileArray.map((f) => ({
      file: f,
      uploading: true,
      progress: 0,
    }));

    setPendingAttachments((prev) => [...prev, ...newPending]);

    for (const pending of newPending) {
      try {
        const attachment = await processFileForAttachment(pending.file, (prog) => {
          setPendingAttachments((curr) =>
            curr.map((p) =>
              p.file === pending.file ? { ...p, progress: prog } : p
            )
          );
        });

        setPendingAttachments((curr) =>
          curr.map((p) =>
            p.file === pending.file
              ? { ...p, uploading: false, progress: 100, attachment }
              : p
          )
        );
      } catch (err: any) {
        console.error('File process error:', err);
        setPendingAttachments((curr) =>
          curr.map((p) =>
            p.file === pending.file
              ? { ...p, uploading: false, error: err.message || 'Upload failed' }
              : p
          )
        );
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleFiles(pastedFiles);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const applySlashCommand = (item: (typeof SLASH_COMMANDS)[number]) => {
      if (item.autoSend) {
        setInput('');
        void sendMessage(item.template);
      } else {
        setInput(item.template);
        textareaRef.current?.focus();
      }
      setSlashIndex(0);
    };

    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const chosen = filteredCommands[slashIndex] || filteredCommands[0];
        if (chosen) applySlashCommand(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isAnyFileUploading = pendingAttachments.some((p) => p.uploading);
  const canSend =
    (input.trim().length > 0 || pendingAttachments.some((p) => p.attachment)) &&
    !isAnyFileUploading;

  const handleSubmit = async () => {
    if (isStreaming) {
      stopStreaming();
      return;
    }

    if (!canSend) return;

    unlockSpeechSynthesis();

    const readyAttachments: Attachment[] = pendingAttachments
      .map((p) => p.attachment)
      .filter((a): a is Attachment => Boolean(a));

    const promptText = input.trim();
    setInput('');
    setPendingAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage(promptText, readyAttachments);
  };

  return (
    <div className="shrink-0 px-3 sm:px-4 pt-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[var(--j-bg)] via-[var(--j-bg)] to-transparent">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Attachment chips preview */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-[var(--j-surface)] border border-[var(--j-border)]">
            {pendingAttachments.map((item, idx) => {
              const isImage = item.file.type.startsWith('image/');
              const isAudio = item.file.type.startsWith('audio/') || item.file.type.includes('mp4');

              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-lg text-xs border bg-[var(--j-surface-alt)] border-[var(--j-border)] text-[var(--j-text)]"
                >
                  {item.uploading ? (
                    <Loader2 className="w-3.5 h-3.5 text-[var(--j-accent)] animate-spin shrink-0" />
                  ) : isImage ? (
                    <ImageIcon className="w-3.5 h-3.5 text-[var(--j-accent)] shrink-0" />
                  ) : isAudio ? (
                    <Music className="w-3.5 h-3.5 text-[var(--j-accent)] shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-[var(--j-accent)] shrink-0" />
                  )}

                  <span className="truncate max-w-[140px]" title={item.file.name}>
                    {item.file.name}
                  </span>

                  {item.error ? (
                    <span className="text-[10px] text-[var(--j-text-muted)]">Failed</span>
                  ) : item.uploading ? (
                    <span className="text-[10px] text-[var(--j-text-muted)]">{item.progress}%</span>
                  ) : null}

                  <button
                    onClick={() => handleRemoveAttachment(idx)}
                    className="p-0.5 rounded hover:bg-[var(--j-surface-hover)] text-[var(--j-text-muted)] hover:text-[var(--j-text)] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Slash Command Menu */}
        {showSlashMenu && (
          <div className="rounded-xl bg-[var(--j-surface)] border border-[var(--j-border-strong)] shadow-xl p-1.5 space-y-0.5">
            {filteredCommands.map((item, idx) => (
              <button
                key={item.cmd}
                type="button"
                onClick={() => {
                  if (item.autoSend) {
                    setInput('');
                    void sendMessage(item.template);
                  } else {
                    setInput(item.template);
                    textareaRef.current?.focus();
                  }
                  setSlashIndex(0);
                }}
                onMouseEnter={() => setSlashIndex(idx)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                  idx === slashIndex
                    ? 'bg-[var(--j-surface-hover)] text-[var(--j-text)]'
                    : 'text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-alt)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[11px] font-semibold text-[var(--j-accent)]">
                    {item.cmd}
                  </span>
                  <span className="font-medium text-[var(--j-text)] truncate">{item.label}</span>
                </div>
                <span className="text-[11px] text-[var(--j-text-muted)] truncate hidden sm:inline">
                  {item.desc}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className="relative rounded-2xl bg-[var(--j-surface-glass)] backdrop-blur-md border border-[var(--j-border)] focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/20 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSlashIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message Jasmine or type / for commands..."
            rows={1}
            className="w-full resize-none bg-transparent px-3.5 sm:px-4 py-3 sm:py-3.5 pr-32 text-[15px] sm:text-sm text-[var(--j-text)] placeholder-[var(--j-text-muted)] focus:outline-none max-h-[200px] leading-relaxed"
          />

          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              multiple
              accept="image/*,application/pdf,audio/*,video/mp4"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              aria-label="Attach file"
              className="p-2 rounded-xl text-[var(--j-accent)] bg-[var(--j-surface-alt)] hover:bg-[var(--j-surface-hover)] disabled:opacity-40 transition-colors border border-[var(--j-border)]"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                unlockSpeechSynthesis();
                setVoiceModeOpen(true);
              }}
              disabled={isStreaming}
              aria-label="Start Jasmine voice mode"
              title="Voice mode (Jasmine)"
              className="p-2 rounded-xl text-[var(--j-accent)] bg-[var(--j-surface-alt)] hover:bg-[var(--j-surface-hover)] disabled:opacity-40 transition-colors border border-[var(--j-border)]"
            >
              <AudioLines className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isStreaming && !canSend}
              aria-label={isStreaming ? 'Stop generating' : 'Send message'}
              className={`p-2 rounded-xl transition-all border ${
                isStreaming
                  ? 'bg-[var(--j-text)] text-[var(--j-bg)] border-[var(--j-text)]'
                  : canSend
                  ? 'bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] hover:from-[#1D4ED8] hover:to-[#1E3A8A] text-white border-[#93C5FD]/30 shadow-md shadow-blue-600/25'
                  : 'bg-[var(--j-surface-alt)] text-[var(--j-accent)] border-[var(--j-border-strong)] cursor-not-allowed'
              }`}
            >
              {isStreaming ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--j-text-muted)] select-none px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedModel(isDeepModel ? 'gemini-3.5-flash-lite' : 'gemini-4-hydrogen')
              }
              title="Toggle Fast vs Deep Reasoning model"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--j-surface)] border border-[var(--j-border)] hover:border-[var(--j-border-strong)] text-[var(--j-text-secondary)] hover:text-[var(--j-text)] transition-colors"
            >
              {isDeepModel ? (
                <>
                  <Sparkles className="w-3 h-3 text-[var(--j-accent)]" />
                  <span>Deep reasoning</span>
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 text-[var(--j-accent)]" />
                  <span>Fast</span>
                </>
              )}
            </button>
            <span className="font-mono tabular-nums hidden sm:inline">
              ~{estimatedTokens.toLocaleString()} tok
            </span>
          </div>
          <span>Type / for commands · Verify important details</span>
        </div>
      </div>
    </div>
  );
}
