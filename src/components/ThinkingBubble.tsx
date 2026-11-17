'use client';

import React, { useEffect, useState } from 'react';
import { JasmineIcon } from './JasmineLogo';

interface ThinkingBubbleProps {
  hasAttachments?: boolean;
  isDeepModel?: boolean;
}

export function ThinkingBubble({
  hasAttachments = false,
  isDeepModel = false,
}: ThinkingBubbleProps) {
  const steps = hasAttachments
    ? [
        'Inspecting your attachments',
        'Extracting key context',
        'Thinking through the details',
        'Putting her reply together',
      ]
    : isDeepModel
    ? [
        'Reading your prompt',
        'Reasoning through angles',
        'Structuring the response',
        'Refining the details',
      ]
    : [
        'Reading your message',
        'Connecting the dots',
        'Thinking through the details',
        'Drafting her reply',
      ];

  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 1500);

    return () => {
      clearInterval(timer);
      clearInterval(stepInterval);
    };
  }, [steps.length]);

  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div
      className="relative overflow-hidden inline-flex flex-col gap-2.5 min-w-[240px] max-w-[320px] px-4 py-3 rounded-2xl rounded-tl-sm bg-[var(--j-surface-alt)] border border-[var(--j-border-strong)] shadow-sm select-none"
      role="status"
      aria-label="Jasmine is thinking"
    >
      {/* Top row: Blooming icon + active step + elapsed timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[var(--j-surface)] border border-[var(--j-border-strong)] flex items-center justify-center shrink-0">
            <div className="jasmine-bloom">
              <JasmineIcon size={14} />
            </div>
          </div>

          <span
            key={stepIndex}
            className="text-xs font-medium text-[var(--j-text)] truncate jasmine-step-in"
          >
            {steps[stepIndex]}
          </span>
        </div>

        <span className="text-[11px] font-mono tabular-nums text-[var(--j-text-muted)] shrink-0">
          {elapsedSeconds}s
        </span>
      </div>

      {/* Middle row: Neural waveform bars + 3 thinking dots */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 h-3.5" aria-hidden="true">
          {[0, 120, 240, 360, 480].map((delay, i) => (
            <span
              key={i}
              style={{ animationDelay: `${delay}ms` }}
              className="w-0.5 h-3 rounded-full bg-[var(--j-accent)] jasmine-wave-bar"
            />
          ))}
          <span className="ml-2 text-[11px] text-[var(--j-text-secondary)]">
            Jasmine is thinking
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-3" />
        </div>
      </div>

      {/* Bottom shimmer progress sweep */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--j-border)] overflow-hidden">
        <div className="w-2/5 h-full bg-gradient-to-r from-transparent via-[var(--j-accent)] to-transparent jasmine-shimmer-line" />
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div
      className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 rounded-full bg-[var(--j-surface-alt)] border border-[var(--j-border)] text-[11px] text-[var(--j-text-secondary)] select-none"
      role="status"
      aria-label="Jasmine is typing"
    >
      <div className="jasmine-bloom">
        <JasmineIcon size={12} />
      </div>
      <span>Jasmine is typing</span>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        <span className="w-1 h-1 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-1" />
        <span className="w-1 h-1 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-2" />
        <span className="w-1 h-1 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-3" />
      </span>
    </div>
  );
}
