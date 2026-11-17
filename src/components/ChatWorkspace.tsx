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

export function ChatWorkspace() {
  const { initFromStorage } = useChatStore();

  useEffect(() => {
    initFromStorage();
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => void r.unregister());
        }).catch(() => {});
      } else {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
    }
  }, [initFromStorage]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--j-bg)] text-[var(--j-text)] antialiased font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--j-bg)]">
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
