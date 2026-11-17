'use client';

import React, { useEffect, useState } from 'react';
import { ReasoningStep } from '../types/chat';
import {
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  FileText,
  Brain,
  Cpu,
  PenLine,
  Search,
  Mail,
  Calendar,
  HardDrive,
  Globe,
} from 'lucide-react';
import { JasmineIcon } from './JasmineLogo';

interface ReasoningStepsProps {
  steps: ReasoningStep[];
  status: 'running' | 'done';
  duration?: number;
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getStepIcon(kind: ReasoningStep['kind']) {
  switch (kind) {
    case 'read':
      return <FileText className="w-3.5 h-3.5" />;
    case 'analyze':
      return <Cpu className="w-3.5 h-3.5" />;
    case 'write':
      return <PenLine className="w-3.5 h-3.5" />;
    case 'search':
      return <Search className="w-3.5 h-3.5" />;
    case 'mail':
      return <Mail className="w-3.5 h-3.5" />;
    case 'calendar':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'drive':
      return <HardDrive className="w-3.5 h-3.5" />;
    case 'globe':
      return <Globe className="w-3.5 h-3.5" />;
    case 'memory':
    case 'thought':
    default:
      return <Brain className="w-3.5 h-3.5" />;
  }
}

export function ReasoningSteps({ steps, status, duration }: ReasoningStepsProps) {
  const [expanded, setExpanded] = useState(status === 'running');
  const [liveMs, setLiveMs] = useState(0);

  // Auto-expand when running, collapse smoothly once done if user didn't toggle
  useEffect(() => {
    if (status === 'running') {
      setExpanded(true);
      const start = Date.now();
      const interval = setInterval(() => {
        setLiveMs(Date.now() - start);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setExpanded(false);
    }
  }, [status]);

  if (!steps || steps.length === 0) return null;

  const displayDuration =
    status === 'running'
      ? `${(liveMs / 1000).toFixed(1)}s`
      : duration
      ? `${(duration / 1000).toFixed(1)}s`
      : '';

  const activeStep = steps.find((s) => s.status === 'running') || steps[steps.length - 1];

  return (
    <div className="mb-3 rounded-xl bg-[var(--j-surface)] border border-[var(--j-border)] overflow-hidden select-none">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-[var(--j-surface-alt)] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-5 h-5 rounded-full bg-[var(--j-surface-alt)] border border-[var(--j-border-strong)] flex items-center justify-center shrink-0 ${
              status === 'running' ? 'jasmine-bloom' : ''
            }`}
          >
            <JasmineIcon size={12} />
          </div>

          <span className="font-medium text-[var(--j-text)] truncate">
            {status === 'running'
              ? activeStep?.title
                ? `Jasmine is thinking · ${activeStep.title}`
                : 'Jasmine is thinking'
              : `Thought for ${displayDuration || 'a moment'} (${steps.length} ${steps.length === 1 ? 'step' : 'steps'})`}
          </span>

          {status === 'running' && (
            <span className="inline-flex items-center gap-0.5 ml-0.5" aria-hidden="true">
              <span className="w-1 h-1 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-1" />
              <span className="w-1 h-1 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-2" />
              <span className="w-1 h-1 rounded-full bg-[var(--j-dot)] jasmine-dot jasmine-dot-3" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[var(--j-text-muted)]">
          {status === 'running' && displayDuration && (
            <span className="font-mono text-[11px] tabular-nums">{displayDuration}</span>
          )}
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Bottom shimmer line while actively running */}
      {status === 'running' && (
        <div className="h-[2px] w-full bg-[var(--j-border)] overflow-hidden">
          <div className="w-2/5 h-full bg-gradient-to-r from-transparent via-[var(--j-accent)] to-transparent jasmine-shimmer-line" />
        </div>
      )}

      {/* Expanded Vertical Timeline */}
      {expanded && (
        <div className="px-3.5 pb-3 pt-2 border-t border-[var(--j-border)] space-y-2.5 bg-[var(--j-surface-alt)]/40">
          <div className="relative pl-5 space-y-3 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[1px] before:bg-[var(--j-border-strong)]">
            {steps.map((step) => {
              const isRunning = step.status === 'running';
              const isError = step.status === 'error';

              return (
                <div key={step.id} className="relative jasmine-step-in">
                  {/* Timeline Node */}
                  <div
                    className={`absolute -left-5 top-0.5 w-[19px] h-[19px] rounded-full flex items-center justify-center border ${
                      isRunning
                        ? 'bg-[var(--j-surface)] border-[var(--j-accent)] text-[var(--j-accent)]'
                        : isError
                        ? 'bg-[var(--j-surface)] border-[var(--j-border-strong)] text-[var(--j-text-muted)]'
                        : 'bg-[var(--j-surface)] border-[var(--j-border-strong)] text-[var(--j-accent)]'
                    }`}
                  >
                    {isRunning ? (
                      <span className="w-2 h-2 rounded-full bg-[var(--j-accent)] animate-pulse" />
                    ) : isError ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </div>

                  {/* Step Body */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[var(--j-accent)] shrink-0">
                          {getStepIcon(step.kind)}
                        </span>
                        <span
                          className={`font-medium truncate ${
                            isRunning ? 'text-[var(--j-text)]' : 'text-[var(--j-text-secondary)]'
                          }`}
                        >
                          {step.title}
                        </span>
                        {step.detail && (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--j-surface)] border border-[var(--j-border)] text-[10px] text-[var(--j-text-muted)] truncate max-w-[140px]">
                            {step.detail}
                          </span>
                        )}
                      </div>

                      {step.duration !== undefined && step.duration > 0 && (
                        <span className="font-mono text-[10px] tabular-nums text-[var(--j-text-muted)] shrink-0">
                          {formatDuration(step.duration)}
                        </span>
                      )}
                    </div>

                    {step.content && (
                      <p className="text-[11px] text-[var(--j-text-muted)] leading-relaxed pl-5">
                        {step.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
