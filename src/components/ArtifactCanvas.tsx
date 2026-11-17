'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Download, Code2, Eye } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export function ArtifactCanvas() {
  const { activeArtifact, setArtifactVersion, closeArtifact } = useChatStore();
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [copied, setCopied] = useState(false);

  if (!activeArtifact) return null;

  const content = activeArtifact.versions[activeArtifact.activeVersionIndex] || '';
  const lang = activeArtifact.language.toLowerCase();
  const canPreview = lang === 'html' || lang === 'svg';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const ext = lang === 'html' ? 'html' : lang === 'svg' ? 'svg' : lang === 'markdown' ? 'md' : lang || 'txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeArtifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[460px] lg:w-[540px] md:static flex flex-col border-l border-[var(--j-border)] bg-[var(--j-surface)] text-[var(--j-text)] h-full shrink-0"
      aria-label="Artifact Canvas"
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between gap-2 border-b border-[var(--j-border)] shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{activeArtifact.title}</div>
          <div className="text-[11px] text-[var(--j-text-muted)] font-mono">
            {activeArtifact.language || 'text'}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {canPreview && (
            <div className="inline-flex rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  viewMode === 'code'
                    ? 'bg-[var(--j-surface-alt)] text-[var(--j-text)]'
                    : 'text-[var(--j-text-muted)] hover:text-[var(--j-text)]'
                }`}
              >
                <Code2 className="w-3 h-3" />
                <span>Code</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-[var(--j-surface-alt)] text-[var(--j-text)]'
                    : 'text-[var(--j-text-muted)] hover:text-[var(--j-text)]'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title="Copy artifact"
            className="p-2 rounded-lg text-[var(--j-text-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-hover)] transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Download file"
            className="p-2 rounded-lg text-[var(--j-text-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-hover)] transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={closeArtifact}
            title="Close canvas"
            className="p-2 rounded-lg text-[var(--j-text-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Version Switcher */}
      {activeArtifact.versions.length > 1 && (
        <div className="px-4 py-2 border-b border-[var(--j-border)] flex items-center gap-1.5 overflow-x-auto bg-[var(--j-bg)]">
          <span className="text-[11px] text-[var(--j-text-muted)] mr-1">Versions:</span>
          {activeArtifact.versions.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setArtifactVersion(idx)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                idx === activeArtifact.activeVersionIndex
                  ? 'bg-[var(--j-accent)] text-[var(--j-accent-fg)]'
                  : 'bg-[var(--j-surface)] border border-[var(--j-border)] text-[var(--j-text-secondary)] hover:bg-[var(--j-surface-hover)]'
              }`}
            >
              v{idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto bg-[var(--j-bg)]">
        {canPreview && viewMode === 'preview' ? (
          <iframe
            title={activeArtifact.title}
            sandbox="allow-scripts"
            srcDoc={
              lang === 'svg'
                ? `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;">${content}</body></html>`
                : content
            }
            className="w-full h-full bg-white border-0"
          />
        ) : (
          <pre className="p-4 text-[12.5px] leading-relaxed font-mono text-[var(--j-text)] whitespace-pre-wrap break-words">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </aside>
  );
}
