'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Brain, Plus, Trash2, Check } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export function ProfileMemoryModal() {
  const {
    profileModalOpen,
    setProfileModalOpen,
    profile,
    updateProfile,
    memories,
    addMemory,
    removeMemory,
    clearMemories,
  } = useChatStore();

  const [name, setName] = useState(profile.name);
  const [cityTimezone, setCityTimezone] = useState(profile.cityTimezone);
  const [role, setRole] = useState(profile.role);
  const [emailSignature, setEmailSignature] = useState(profile.emailSignature);
  const [communicationRules, setCommunicationRules] = useState(profile.communicationRules);
  const [newMemory, setNewMemory] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!profileModalOpen) return;
    setName(profile.name);
    setCityTimezone(profile.cityTimezone);
    setRole(profile.role);
    setEmailSignature(profile.emailSignature);
    setCommunicationRules(profile.communicationRules);
  }, [profileModalOpen, profile]);

  useEffect(() => {
    if (!profileModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [profileModalOpen, setProfileModalOpen]);

  if (!profileModalOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: name.trim(),
      cityTimezone: cityTimezone.trim(),
      role: role.trim(),
      emailSignature: emailSignature.trim(),
      communicationRules: communicationRules.trim(),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    addMemory(newMemory.trim());
    setNewMemory('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Profile and Memory"
      onClick={() => setProfileModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl max-h-[88dvh] overflow-y-auto rounded-2xl bg-[var(--j-surface)] border border-[var(--j-border)] shadow-2xl text-[var(--j-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--j-border)] sticky top-0 bg-[var(--j-surface)] z-10">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-[var(--j-accent)]" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold">Profile &amp; Personal Memory</h2>
          </div>
          <button
            type="button"
            onClick={() => setProfileModalOpen(false)}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[var(--j-text-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Profile Card */}
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-[var(--j-text-secondary)]">
                Your Profile Card
              </h3>
              {savedNotice && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-[var(--j-text-muted)]">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full h-9 px-3 rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--j-text-muted)]">City / Timezone</span>
                <input
                  type="text"
                  value={cityTimezone}
                  onChange={(e) => setCityTimezone(e.target.value)}
                  placeholder="e.g. Lagos (WAT)"
                  className="w-full h-9 px-3 rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--j-text-muted)]">Role</span>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Product Designer"
                  className="w-full h-9 px-3 rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--j-text-muted)]">Email signature</span>
                <input
                  type="text"
                  value={emailSignature}
                  onChange={(e) => setEmailSignature(e.target.value)}
                  placeholder="e.g. Best, Alex"
                  className="w-full h-9 px-3 rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)]"
                />
              </label>
            </div>

            <label className="block space-y-1 text-xs">
              <span className="text-[var(--j-text-muted)]">Communication rules</span>
              <textarea
                rows={2}
                value={communicationRules}
                onChange={(e) => setCommunicationRules(e.target.value)}
                placeholder="e.g. Always write concise emails, skip corporate buzzwords, prefer afternoon meetings."
                className="w-full p-3 rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)] resize-none"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-[var(--j-accent)] hover:bg-[var(--j-accent-hover)] text-[var(--j-accent-fg)] text-xs font-medium transition-colors"
              >
                Save profile
              </button>
            </div>
          </form>

          {/* Saved Memories */}
          <div className="border-t border-[var(--j-border)] pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--j-accent)]" strokeWidth={1.5} />
                <h3 className="text-xs font-medium text-[var(--j-text-secondary)]">
                  Saved Memories ({memories.length})
                </h3>
              </div>
              {memories.length > 0 && (
                <button
                  type="button"
                  onClick={clearMemories}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <form onSubmit={handleAddMemory} className="flex gap-2">
              <input
                type="text"
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="Add a fact or preference for Jasmine to remember..."
                className="flex-1 h-9 px-3 rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] text-xs text-[var(--j-text)] focus:outline-none focus:border-[var(--j-accent)]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--j-surface-alt)] hover:bg-[var(--j-surface-hover)] border border-[var(--j-border)] text-xs font-medium text-[var(--j-text)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>

            {memories.length === 0 ? (
              <p className="text-xs text-[var(--j-text-muted)] py-2">
                No memories saved yet. Tell Jasmine about yourself in chat or voice mode and she will remember automatically.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {memories.map((fact, idx) => (
                  <li
                    key={`${idx}-${fact.slice(0, 16)}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--j-bg)] border border-[var(--j-border)] text-xs"
                  >
                    <span className="text-[var(--j-text)] leading-relaxed">{fact}</span>
                    <button
                      type="button"
                      onClick={() => removeMemory(idx)}
                      aria-label="Delete memory"
                      className="p-1 text-[var(--j-text-muted)] hover:text-rose-500 shrink-0 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
