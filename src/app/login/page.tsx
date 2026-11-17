'use client';

import React, { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Mail, AudioLines, Calendar, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { JasmineLockup } from '../../components/JasmineLogo';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  return (
    <main className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[var(--j-bg)] text-[var(--j-text)] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-[var(--j-surface)] border border-[var(--j-border)] p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <JasmineLockup height={48} />
          <p className="text-xs sm:text-sm text-[var(--j-text-secondary)] leading-relaxed">
            Sign in with your Google account to access Jasmine, live voice conversations, and your workspace tools.
          </p>
        </div>

        <div className="space-y-2.5 rounded-xl bg-[var(--j-bg)] border border-[var(--j-border)] p-4 text-xs text-[var(--j-text-secondary)]">
          <div className="flex items-center gap-2.5">
            <AudioLines className="w-4 h-4 text-[var(--j-accent)] shrink-0" strokeWidth={1.5} />
            <span>Real-time Gemini Live voice conversations</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-[var(--j-accent)] shrink-0" strokeWidth={1.5} />
            <span>Gmail inbox search &amp; human-approved drafts</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-[var(--j-accent)] shrink-0" strokeWidth={1.5} />
            <span>Google Calendar, Drive, Tasks &amp; personal memory</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/' })}
          disabled={status === 'loading'}
          className="w-full h-11 px-4 rounded-xl bg-[var(--j-accent)] hover:bg-[var(--j-accent-hover)] text-[var(--j-accent-fg)] text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking session...</span>
            </>
          ) : (
            <>
              <span>Continue with Google</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--j-text-muted)]">
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Protected by Google OAuth 2.0</span>
        </div>
      </div>
    </main>
  );
}
