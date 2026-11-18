'use client';

import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { JustinaVoiceOverlay } from './JustinaVoiceOverlay';
import { ArtifactCanvas } from './ArtifactCanvas';
import { ProfileMemoryModal } from './ProfileMemoryModal';
import { CommandPalette } from './CommandPalette';
import { registerServiceWorker } from '../lib/pwa/registerPwa';

export function ChatWorkspace() {
  const { initFromStorage } = useChatStore();

  useEffect(() => {
    initFromStorage();
    void registerServiceWorker().catch(() => {});
  }, [initFromStorage]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--j-bg)] text-[var(--j-text)] antialiased font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--j-bg)] overflow-hidden">
        {/* Diffused Ambient Brand Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,var(--j-bg-glow),transparent_70%)]"
        />
        <TopBar />
        <MessageList />
        <Composer />
      </main>

      <ArtifactCanvas />
      <JustinaVoiceOverlay />
      <ProfileMemoryModal />
      <CommandPalette />
    </div>
  );
}
