'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import vscDarkPlus from 'react-syntax-highlighter/dist/cjs/styles/prism/vsc-dark-plus';
import oneLight from 'react-syntax-highlighter/dist/cjs/styles/prism/one-light';

const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter/dist/cjs/prism').then((mod) => mod.default || (mod as any)),
  { ssr: false }
);
import { useChatStore } from '../store/useChatStore';
import { AVAILABLE_MODELS, Message, Attachment, PendingEmailAction } from '../types/chat';
import {
  User,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  FileText,
  Music,
  ArrowDown,
  Code2,
  Compass,
  Lightbulb,
  FileSearch,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Send,
  X,
  ExternalLink,
  Globe,
  Loader2,
  Volume2,
  Square,
  PanelRight,
  Pencil,
} from 'lucide-react';
import { JasmineIcon, JasmineLockup } from './JasmineLogo';
import { ThinkingBubble, TypingIndicator } from './ThinkingBubble';
import { ReasoningSteps } from './ReasoningSteps';

const STARTER_PROMPTS = [
  {
    icon: <Code2 className="w-4 h-4 text-[var(--j-accent)]" />,
    title: 'Write a rate limiter',
    desc: 'Sliding-window log rate limiter in TypeScript with tests',
    prompt: 'Write a production-ready asynchronous rate-limiter in TypeScript using a sliding window log algorithm with tests.',
  },
  {
    icon: <Compass className="w-4 h-4 text-[var(--j-accent)]" />,
    title: 'Compare architectures',
    desc: 'Event-driven queues vs WebSockets for real-time messaging',
    prompt: 'Compare Event-Driven Architecture with persistent WebSockets for high-scale real-time collaboration. Detail pros, cons, and failure modes.',
  },
  {
    icon: <Lightbulb className="w-4 h-4 text-[var(--j-accent)]" />,
    title: 'Explain a concept',
    desc: 'Quantum superposition and entanglement with clear intuition',
    prompt: 'Explain quantum superposition and entanglement in intuitive terms with real-world analogies, mathematical intuition, and common misconceptions.',
  },
  {
    icon: <FileSearch className="w-4 h-4 text-[var(--j-accent)]" />,
    title: 'Debug React closures',
    desc: 'Fix stale closures and memory leaks inside useEffect hooks',
    prompt: 'Explain how JavaScript closures in React useEffect hooks cause subtle memory leaks and zombie event listeners, with code before/after fixes.',
  },
];

interface CodeBlockProps {
  language: string;
  value: string;
  theme: 'light' | 'dark';
}

function CodeBlock({ language, value, theme }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-[var(--j-border)] bg-[var(--j-surface)] text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--j-surface-alt)] border-b border-[var(--j-border)] text-[var(--j-text-secondary)] select-none">
        <span className="font-mono text-[11px] text-[var(--j-text)] lowercase">{language || 'text'}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              useChatStore.getState().openArtifact({
                title: `${language || 'code'} snippet`,
                language: language || 'text',
                content: value,
              })
            }
            className="flex items-center gap-1 text-[11px] text-[var(--j-text-secondary)] hover:text-[var(--j-text)] transition-colors"
            title="Open in Artifact Canvas"
          >
            <PanelRight className="w-3 h-3" />
            <span>Canvas</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-[var(--j-text-secondary)] hover:text-[var(--j-text)] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[var(--j-accent)]" />
                <span className="text-[var(--j-text)]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto p-3 font-mono">
        <SyntaxHighlighter
          language={language || 'text'}
          style={theme === 'dark' ? vscDarkPlus : oneLight}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '12.5px',
            lineHeight: '1.6',
          }}
          wrapLines={true}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType.startsWith('image/');
  const isAudio = attachment.mimeType.startsWith('audio/') || attachment.mimeType.includes('mp4');

  if (isImage && (attachment.url || attachment.base64Data)) {
    const src = attachment.url || `data:${attachment.mimeType};base64,${attachment.base64Data}`;
    return (
      <div className="relative group rounded-lg overflow-hidden border border-[var(--j-border-strong)] max-w-[200px] max-h-[140px] bg-[var(--j-surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={attachment.name} className="object-cover w-full h-full" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--j-surface)] border border-[var(--j-border)] text-xs text-[var(--j-text)]">
      {isAudio ? (
        <Music className="w-3.5 h-3.5 text-[var(--j-accent)] shrink-0" />
      ) : (
        <FileText className="w-3.5 h-3.5 text-[var(--j-accent)] shrink-0" />
      )}
      <span className="truncate max-w-[150px]" title={attachment.name}>
        {attachment.name}
      </span>
    </div>
  );
}

function formatModelDisplayName(modelId?: string): string {
  if (!modelId) return '';
  const match = AVAILABLE_MODELS.find((m) => m.id === modelId);
  return match ? match.name : modelId;
}

function formatErrorMessage(raw?: string): string {
  if (!raw) return 'Unable to complete this request.';
  if (raw.includes('503') || /high demand|unavailable/i.test(raw)) {
    return 'Jasmine is temporarily experiencing high demand. Click Retry to send your message again.';
  }
  if (raw.includes('429') || /quota|rate limit/i.test(raw)) {
    return 'Rate limit reached. Please wait a moment and click Retry.';
  }
  return raw;
}

interface EmailConfirmationCardProps {
  threadId: string;
  messageId: string;
  action: PendingEmailAction;
}

function EmailConfirmationCard({ threadId, messageId, action }: EmailConfirmationCardProps) {
  const { updatePendingEmailStatus } = useChatStore();
  const [body, setBody] = useState(action.payload.body);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isPending = action.status === 'pending';

  const handleApproveAndSend = async () => {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: action.payload.to,
          subject: action.payload.subject,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to send email (${res.status})`);
      }
      updatePendingEmailStatus(threadId, messageId, 'sent', {
        ...action.payload,
        body,
      });
    } catch (err: any) {
      setSendError(err?.message || 'Unable to send email.');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    updatePendingEmailStatus(threadId, messageId, 'cancelled', {
      ...action.payload,
      body,
    });
  };

  return (
    <div className="my-3 rounded-xl bg-[var(--j-surface)] border border-[var(--j-border-strong)] p-3.5 space-y-3 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-[var(--j-text)]">
          <Mail className="w-4 h-4 text-[var(--j-accent)]" />
          <span>Email Draft Confirmation</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-[var(--j-surface-alt)] border border-[var(--j-border)] text-[11px] text-[var(--j-text-secondary)]">
          {action.status === 'sent'
            ? 'Sent'
            : action.status === 'cancelled'
              ? 'Cancelled'
              : 'Awaiting approval'}
        </span>
      </div>

      <div className="space-y-1.5 text-[var(--j-text-secondary)]">
        <div>
          <span className="text-[var(--j-text-muted)]">To: </span>
          <span className="text-[var(--j-text)] font-medium">{action.payload.to}</span>
        </div>
        <div>
          <span className="text-[var(--j-text-muted)]">Subject: </span>
          <span className="text-[var(--j-text)] font-medium">{action.payload.subject}</span>
        </div>
      </div>

      {isPending ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-lg bg-[var(--j-surface-alt)] border border-[var(--j-border)] p-2.5 text-xs text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)] leading-relaxed"
        />
      ) : (
        <div className="rounded-lg bg-[var(--j-surface-alt)] border border-[var(--j-border)] p-2.5 text-xs text-[var(--j-text-secondary)] whitespace-pre-wrap leading-relaxed">
          {action.payload.body}
        </div>
      )}

      {sendError && (
        <p className="text-[11px] text-[var(--j-accent)]">{sendError}</p>
      )}

      {isPending && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleApproveAndSend}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--j-accent)] hover:bg-[var(--j-accent-hover)] text-[var(--j-accent-fg)] font-medium transition-colors disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{sending ? 'Sending...' : 'Approve & Send'}</span>
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--j-surface-alt)] hover:bg-[var(--j-surface-hover)] text-[var(--j-text-secondary)] border border-[var(--j-border)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function MessageList() {
  const {
    activeThreadId,
    messagesByThread,
    regenerateMessage,
    setMessageFeedback,
    sendMessage,
    theme,
    speakingMessageId,
    speakMessage,
    stopSpeaking,
    editAndResendMessage,
  } = useChatStore();

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');

  const messages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
      setUserHasScrolledUp(false);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setUserHasScrolledUp(!isAtBottom);
  };

  useEffect(() => {
    if (!userHasScrolledUp) {
      scrollToBottom('auto');
    }
  }, [messages, userHasScrolledUp]);

  const handleCopyMessage = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMessageId(msg.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (e) {
      console.error('Failed to copy message:', e);
    }
  };

  let latestAssistantId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'model') {
      latestAssistantId = messages[i].id;
      break;
    }
  }

  // Welcome State
  if (!activeThreadId || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 select-none overflow-y-auto">
        <div className="max-w-2xl w-full flex flex-col items-center text-center space-y-6">
          <div className="text-[var(--j-text)]">
            <JasmineLockup height={56} />
          </div>

          <p className="text-sm text-[var(--j-text-secondary)] max-w-md leading-relaxed">
            Ask a question, drop a file, or pick a prompt to start
          </p>

          {/* 2x2 Starter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-2 text-left">
            {STARTER_PROMPTS.map((card, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(card.prompt)}
                className="group flex flex-col justify-between p-4 rounded-xl bg-[var(--j-surface)] hover:bg-[var(--j-surface-alt)] border border-[var(--j-border)] hover:border-[var(--j-border-strong)] transition-colors text-xs shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2 font-medium text-[var(--j-text)]">
                  {card.icon}
                  <span>{card.title}</span>
                </div>
                <p className="text-[var(--j-text-secondary)] line-clamp-2 leading-relaxed">
                  {card.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-4 sm:p-6 space-y-5 sm:space-y-6 relative"
    >
      <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const isStreaming = m.status === 'streaming';
          const isError = m.status === 'error';
          const isLatestAssistant = m.id === latestAssistantId;

          return (
            <div
              key={m.id}
              className={`flex gap-2.5 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Assistant Avatar */}
              {!isUser && (
                <div className="hidden sm:flex w-7 h-7 rounded-lg bg-[var(--j-surface)] border border-[var(--j-border)] items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <JasmineIcon size={18} />
                </div>
              )}

              {/* Message Content Container */}
              <div className={`max-w-[92%] sm:max-w-[82%] min-w-0 space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                {isUser && m.attachments && m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end mb-1.5">
                    {m.attachments.map((att) => (
                      <AttachmentPreview key={att.id} attachment={att} />
                    ))}
                  </div>
                )}

                {isUser ? (
                  editingMsgId === m.id ? (
                    <div className="w-full min-w-[260px] sm:min-w-[360px] p-3 rounded-2xl bg-[var(--j-surface)] border border-[var(--j-accent)] space-y-2 shadow-sm">
                      <textarea
                        autoFocus
                        rows={3}
                        value={editingDraft}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        className="w-full bg-[var(--j-bg)] border border-[var(--j-border)] rounded-lg p-2 text-sm text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)] resize-y"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingMsgId(null)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--j-surface-alt)] text-xs text-[var(--j-text-secondary)] hover:text-[var(--j-text)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextText = editingDraft.trim();
                            setEditingMsgId(null);
                            if (nextText) {
                              void editAndResendMessage(m.id, nextText);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--j-accent)] hover:bg-[var(--j-accent-hover)] text-xs font-medium text-[var(--j-accent-fg)]"
                        >
                          Save &amp; Re-run
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group/user relative flex items-start gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsgId(m.id);
                          setEditingDraft(m.content);
                        }}
                        title="Edit & branch from here"
                        aria-label="Edit message"
                        className="opacity-0 group-hover/user:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-[var(--j-text-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)] transition-opacity mt-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <div className="px-4 py-2.5 rounded-2xl bg-[var(--j-surface-alt)] text-[var(--j-text)] text-sm leading-relaxed whitespace-pre-wrap break-words border border-[var(--j-border)] shadow-sm">
                        {m.content}
                      </div>
                    </div>
                  )
                ) : (
                  <div
                    className={`w-full text-[var(--j-text)] text-sm leading-relaxed prose max-w-none ${theme === 'dark' ? 'prose-invert' : ''
                      }`}
                  >
                    {isError ? (
                      <div className="p-3.5 rounded-xl bg-[var(--j-surface)] border border-[var(--j-border-strong)] text-xs text-[var(--j-text)] space-y-2.5">
                        <div className="flex items-center gap-2 font-medium text-[var(--j-accent)]">
                          <AlertCircle className="w-4 h-4 text-[var(--j-accent)] shrink-0" />
                          <span>Request failed</span>
                        </div>
                        <p className="leading-relaxed text-[var(--j-text-secondary)]">
                          {formatErrorMessage(m.errorMessage)}
                        </p>
                        <button
                          onClick={() => regenerateMessage(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--j-accent)] hover:bg-[var(--j-accent-hover)] text-[11px] font-medium text-[var(--j-accent-fg)] transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {m.reasoningSteps && m.reasoningSteps.length > 0 && (
                          <ReasoningSteps
                            steps={m.reasoningSteps}
                            status={isStreaming ? 'running' : 'done'}
                            duration={m.reasoningDuration}
                          />
                        )}

                        {m.toolStatus && (
                          <div className="mb-2.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--j-surface-alt)] border border-[var(--j-border)] text-[11px] text-[var(--j-text-secondary)]">
                            <Loader2 className="w-3 h-3 text-[var(--j-accent)] animate-spin" />
                            <span>{m.toolStatus}</span>
                          </div>
                        )}

                        {m.content ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                if (!inline && match) {
                                  return (
                                    <CodeBlock
                                      language={match[1]}
                                      value={codeString}
                                      theme={theme}
                                    />
                                  );
                                }
                                return (
                                  <code
                                    className="px-1.5 py-0.5 rounded bg-[var(--j-code-inline-bg)] border border-[var(--j-border)] font-mono text-[12px] text-[var(--j-code-inline-text)]"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              },
                              table({ children }) {
                                return (
                                  <div className="overflow-x-auto my-3 border border-[var(--j-border)] rounded-lg">
                                    <table className="min-w-full divide-y divide-[var(--j-border)] text-xs text-left">
                                      {children}
                                    </table>
                                  </div>
                                );
                              },
                              th({ children }) {
                                return (
                                  <th className="px-3 py-2 bg-[var(--j-surface-alt)] font-medium text-[var(--j-text)]">
                                    {children}
                                  </th>
                                );
                              },
                              td({ children }) {
                                return (
                                  <td className="px-3 py-2 border-t border-[var(--j-border)] text-[var(--j-text-secondary)]">
                                    {children}
                                  </td>
                                );
                              },
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        ) : (
                          isStreaming &&
                          (!m.reasoningSteps || m.reasoningSteps.length === 0) && (
                            <ThinkingBubble
                              hasAttachments={Boolean(
                                messages[messages.indexOf(m) - 1]?.attachments?.length
                              )}
                              isDeepModel={Boolean(m.modelUsed?.includes('hydrogen'))}
                            />
                          )
                        )}

                        {isStreaming && m.content && (
                          <div className="flex items-center gap-2">
                            <TypingIndicator />
                          </div>
                        )}

                        {m.generatedImages && m.generatedImages.length > 0 && (
                          <div className="mt-3 space-y-3">
                            {m.generatedImages.map((img, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl overflow-hidden border border-[var(--j-border)] bg-[var(--j-surface)] shadow-sm max-w-lg"
                              >
                                <img
                                  src={img.url}
                                  alt={img.prompt || 'Generated image'}
                                  className="w-full h-auto object-cover"
                                />
                                <div className="px-3 py-2 flex items-center justify-between gap-2 border-t border-[var(--j-border)] text-[11px] text-[var(--j-text-secondary)]">
                                  <span className="truncate">{img.prompt}</span>
                                  <a
                                    href={img.url}
                                    download={`jasmine-image-${idx + 1}.png`}
                                    className="shrink-0 font-medium text-[var(--j-accent)] hover:underline"
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {m.imageResults && m.imageResults.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {m.imageResults.map((img, idx) => (
                              <a
                                key={idx}
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={img.description || img.url}
                                className="group block rounded-xl overflow-hidden border border-[var(--j-border)] bg-[var(--j-surface)] hover:border-[var(--j-border-strong)] transition-colors"
                              >
                                <img
                                  src={img.url}
                                  alt={img.description || `Search result ${idx + 1}`}
                                  className="w-full h-32 object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}

                        {m.pendingAction && activeThreadId && (
                          <EmailConfirmationCard
                            threadId={activeThreadId}
                            messageId={m.id}
                            action={m.pendingAction}
                          />
                        )}

                        {m.sources && m.sources.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-[var(--j-border)] flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--j-text-muted)] mr-1">
                              <Globe className="w-3 h-3" />
                              Sources
                            </span>
                            {m.sources.map((src, idx) => (
                              <a
                                key={idx}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--j-surface-alt)] hover:bg-[var(--j-surface-hover)] border border-[var(--j-border)] text-[11px] text-[var(--j-text-secondary)] hover:text-[var(--j-text)] transition-colors max-w-[200px]"
                                title={src.uri}
                              >
                                <span className="truncate">{src.title}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Bottom Action Bar */}
                    {!isStreaming && !isError && m.content && (
                      <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--j-text-muted)] select-none">
                        <button
                          onClick={() => handleCopyMessage(m)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)] transition-colors"
                          title="Copy reply"
                        >
                          {copiedMessageId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-[var(--j-accent)]" />
                              <span className="text-[var(--j-text)]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            if (speakingMessageId === m.id) {
                              stopSpeaking();
                            } else {
                              speakMessage(m.id, m.content);
                            }
                          }}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${speakingMessageId === m.id
                            ? 'text-[var(--j-accent)] bg-[var(--j-surface-alt)]'
                            : 'hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)]'
                            }`}
                          title={speakingMessageId === m.id ? 'Stop reading' : 'Read aloud'}
                        >
                          {speakingMessageId === m.id ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>

                        {isLatestAssistant && (
                          <button
                            onClick={() => regenerateMessage(m.id)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)] transition-colors"
                            title="Regenerate response"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Regenerate</span>
                          </button>
                        )}

                        <button
                          onClick={() =>
                            activeThreadId &&
                            setMessageFeedback(
                              activeThreadId,
                              m.id,
                              m.feedback === 'up' ? undefined : 'up'
                            )
                          }
                          aria-label="Helpful"
                          className={`p-1 rounded transition-colors ${m.feedback === 'up'
                            ? 'text-[var(--j-accent)] bg-[var(--j-surface-alt)]'
                            : 'hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)]'
                            }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() =>
                            activeThreadId &&
                            setMessageFeedback(
                              activeThreadId,
                              m.id,
                              m.feedback === 'down' ? undefined : 'down'
                            )
                          }
                          aria-label="Not helpful"
                          className={`p-1 rounded transition-colors ${m.feedback === 'down'
                            ? 'text-[var(--j-accent)] bg-[var(--j-surface-alt)]'
                            : 'hover:text-[var(--j-text)] hover:bg-[var(--j-surface-alt)]'
                            }`}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>

                        {m.modelUsed && (
                          <span className="ml-auto text-[11px] text-[var(--j-text-muted)]">
                            {formatModelDisplayName(m.modelUsed)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="hidden sm:flex w-7 h-7 rounded-lg bg-[var(--j-surface-alt)] border border-[var(--j-border)] items-center justify-center shrink-0 mt-0.5 text-[var(--j-accent)]">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Scroll to Bottom Button */}
      {userHasScrolledUp && (
        <button
          onClick={() => scrollToBottom('smooth')}
          aria-label="Scroll to bottom"
          className="fixed bottom-24 right-4 sm:right-8 p-2 rounded-full bg-[var(--j-surface)] hover:bg-[var(--j-surface-hover)] text-[var(--j-accent)] border border-[var(--j-border-strong)] shadow-lg transition-colors z-20"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
