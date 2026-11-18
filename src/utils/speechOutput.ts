const VOICE_STORAGE_KEY = 'justina_voice_uri';

const PREFERRED_FEMALE_VOICE_NAMES = [
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Zira',
  'Samantha',
  'Victoria',
  'Ava',
  'Allison',
  'Karen',
  'Moira',
  'Tessa',
  'Serena',
  'Google US English',
  'Google UK English Female',
];

export function cleanMarkdownForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/```[\s\S]*?```/g, ' I have placed the code snippet on your screen. ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/g, 'the link on screen')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~|#{1,6}\s+|>)/g, '')
    .replace(/\|/g, ', ')
    .replace(/^[-:,\s]+$/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitIntoSpeechChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length > 0 ? sentences : [text];
}

export function pickDefaultSpeechVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const savedUri =
    typeof window !== 'undefined' ? localStorage.getItem(VOICE_STORAGE_KEY) : null;
  if (savedUri) {
    const found = voices.find((v) => v.voiceURI === savedUri);
    if (found) return found;
  }

  const localVoices = voices.filter((v) => v.localService);
  const pool = localVoices.length > 0 ? localVoices : voices;

  for (const preferred of PREFERRED_FEMALE_VOICE_NAMES) {
    const match = pool.find((v) =>
      v.name.toLowerCase().includes(preferred.toLowerCase())
    );
    if (match) return match;
  }

  return (
    pool.find((v) => v.lang.startsWith('en')) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0]
  );
}

let sharedUnlockAudioCtx: AudioContext | null = null;
let sharedAudioEl: HTMLAudioElement | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let activeObjectUrl: string | null = null;
let activeTtsAbort: AbortController | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedUnlockAudioCtx || sharedUnlockAudioCtx.state === 'closed') {
      sharedUnlockAudioCtx = new AudioCtx();
    }
    return sharedUnlockAudioCtx;
  } catch {
    return null;
  }
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioEl) {
    sharedAudioEl = new Audio();
  }
  return sharedAudioEl;
}

export function unlockSpeechSynthesis(): void {
  if (typeof window === 'undefined') return;
  const ctx = getSharedAudioContext();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => { });
      }
      // Play a silent 1-sample buffer inside the user gesture so Web Audio is unlocked for async replies
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // ignore AudioContext errors
    }
  }

  // Also prime speechSynthesis on user gesture for fallback reliability
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    const unlock = new SpeechSynthesisUtterance('');
    unlock.volume = 0;
    unlock.lang = 'en-US';
    window.speechSynthesis.speak(unlock);
  } catch {
    // ignore browser unlock errors
  }
}

let activeSpeechId = 0;
let activeKeepAlive: ReturnType<typeof setInterval> | null = null;
let activeUtteranceRef: SpeechSynthesisUtterance | null = null;

export function stopSpeechOutput(): void {
  activeSpeechId += 1;
  activeUtteranceRef = null;
  if (activeTtsAbort) {
    activeTtsAbort.abort();
    activeTtsAbort = null;
  }
  if (activeBufferSource) {
    try {
      activeBufferSource.onended = null;
      activeBufferSource.stop();
      activeBufferSource.disconnect();
    } catch {
      // ignore
    }
    activeBufferSource = null;
  }
  if (sharedAudioEl) {
    try {
      sharedAudioEl.onended = null;
      sharedAudioEl.onerror = null;
      sharedAudioEl.pause();
      sharedAudioEl.currentTime = 0;
    } catch {
      // ignore
    }
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  if (activeKeepAlive) {
    clearInterval(activeKeepAlive);
    activeKeepAlive = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore cancel errors
    }
  }
}

function speakWithBrowserFallback(
  spoken: string,
  myId: number,
  callbacks?: { onStart?: () => void; onEnd?: () => void }
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onEnd?.();
    return;
  }

  const chunks = splitIntoSpeechChunks(spoken);
  const voices = window.speechSynthesis.getVoices();
  const defaultVoice = pickDefaultSpeechVoice(voices);

  setTimeout(() => {
    if (activeSpeechId !== myId) return;

    window.speechSynthesis.resume();
    activeKeepAlive = setInterval(() => {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 3000);

    let idx = 0;

    const speakNext = (fallbackDefault = false) => {
      if (activeSpeechId !== myId) return;

      if (idx >= chunks.length) {
        activeUtteranceRef = null;
        if (activeKeepAlive) {
          clearInterval(activeKeepAlive);
          activeKeepAlive = null;
        }
        callbacks?.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[idx]);
      activeUtteranceRef = utterance;
      if (!fallbackDefault && defaultVoice) {
        utterance.voice = defaultVoice;
      } else {
        utterance.lang = 'en-US';
      }
      utterance.volume = 1;
      utterance.rate = 1.02;
      utterance.pitch = 1.02;

      utterance.onend = () => {
        if (activeSpeechId !== myId) return;
        activeUtteranceRef = null;
        idx += 1;
        speakNext(false);
      };

      utterance.onerror = () => {
        if (activeSpeechId !== myId) return;
        activeUtteranceRef = null;
        if (!fallbackDefault && defaultVoice) {
          speakNext(true);
        } else {
          idx += 1;
          speakNext(false);
        }
      };

      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    };

    speakNext(false);
  }, 70);
}

export async function speakTextAloud(
  rawText: string,
  callbacks?: {
    voice?: string;
    onStart?: () => void;
    onEnd?: () => void;
  }
): Promise<void> {
  if (typeof window === 'undefined') {
    callbacks?.onEnd?.();
    return;
  }

  const spoken = cleanMarkdownForSpeech(rawText);
  if (!spoken) {
    callbacks?.onEnd?.();
    return;
  }

  stopSpeechOutput();
  const myId = ++activeSpeechId;
  callbacks?.onStart?.();

  // Primary: HeyGen Voice Turbo (Sabrina) via OpenRouter (/api/tts)
  const controller = new AbortController();
  activeTtsAbort = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: spoken,
        voice: callbacks?.voice || 'sabrina',
      }),
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);

    if (activeSpeechId !== myId) return;

    if (!res.ok) {
      throw new Error(`TTS returned ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    if (activeSpeechId !== myId) return;

    // Prefer Web Audio API (AudioContext unlocked on user gesture) so async voice replies never hit autoplay blocks
    const ctx = getSharedAudioContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        if (activeSpeechId !== myId) return;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        activeBufferSource = source;

        source.onended = () => {
          if (activeBufferSource === source) {
            activeBufferSource = null;
          }
          if (activeSpeechId === myId) {
            callbacks?.onEnd?.();
          }
        };
        source.start(0);
        return;
      } catch (webAudioErr) {
        console.warn('[speechOutput] Web Audio playback fallback to HTMLAudioElement:', webAudioErr);
      }
    }

    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    activeObjectUrl = url;

    const audio = getSharedAudio();
    if (!audio) {
      throw new Error('Audio playback unavailable');
    }

    audio.src = url;
    audio.onended = () => {
      if (activeObjectUrl === url) {
        URL.revokeObjectURL(url);
        activeObjectUrl = null;
      }
      if (activeSpeechId === myId) {
        callbacks?.onEnd?.();
      }
    };
    audio.onerror = () => {
      if (activeObjectUrl === url) {
        URL.revokeObjectURL(url);
        activeObjectUrl = null;
      }
      if (activeSpeechId === myId) {
        speakWithBrowserFallback(spoken, myId, callbacks);
      }
    };

    await audio.play();
  } catch (err: any) {
    window.clearTimeout(timeoutId);
    if (activeSpeechId !== myId) {
      return;
    }
    console.warn('[speechOutput] TTS fallback to browser voice:', err?.message);
    speakWithBrowserFallback(spoken, myId, callbacks);
  }
}

async function fetchTtsSentenceBuffer(
  sentence: string,
  voice: string,
  myId: number
): Promise<ArrayBuffer | null> {
  if (activeSpeechId !== myId) return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sentence, voice }),
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    if (activeSpeechId !== myId || !res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    window.clearTimeout(timeoutId);
    return null;
  }
}

async function playSentenceAudioBuffer(
  arrayBuffer: ArrayBuffer | null,
  fallbackSentence: string,
  myId: number
): Promise<void> {
  if (activeSpeechId !== myId) return;

  if (arrayBuffer) {
    const ctx = getSharedAudioContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        if (activeSpeechId !== myId) return;
        await new Promise<void>((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          activeBufferSource = source;
          source.onended = () => {
            if (activeBufferSource === source) activeBufferSource = null;
            resolve();
          };
          source.start(0);
        });
        return;
      } catch {
        // fall through to HTMLAudioElement
      }
    }

    const audio = getSharedAudio();
    if (audio) {
      try {
        const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        activeObjectUrl = url;
        await new Promise<void>((resolve) => {
          audio.src = url;
          audio.onended = () => {
            if (activeObjectUrl === url) {
              URL.revokeObjectURL(url);
              activeObjectUrl = null;
            }
            resolve();
          };
          audio.onerror = () => {
            if (activeObjectUrl === url) {
              URL.revokeObjectURL(url);
              activeObjectUrl = null;
            }
            resolve();
          };
          void audio.play().catch(() => resolve());
        });
        return;
      } catch {
        // fall through to browser voice
      }
    }
  }

  await new Promise<void>((resolve) => {
    speakWithBrowserFallback(fallbackSentence, myId, {
      onEnd: resolve,
    });
  });
}

export interface StreamingSpeechQueue {
  push: (chunk: string) => void;
  finish: () => void;
  cancel: () => void;
}

/**
 * Stream speech sentence-by-sentence as text chunks arrive, prefetching upcoming
 * sentences in parallel so Jasmine starts speaking within ~1s while still typing.
 */
export function createStreamingSpeechQueue(callbacks?: {
  voice?: string;
  onStart?: () => void;
  onEnd?: () => void;
}): StreamingSpeechQueue {
  if (typeof window === 'undefined') {
    return { push: () => {}, finish: () => callbacks?.onEnd?.(), cancel: () => {} };
  }

  stopSpeechOutput();
  const myId = ++activeSpeechId;
  const voice = callbacks?.voice || 'sabrina';

  let rawBuffer = '';
  let finished = false;
  let started = false;
  let draining = false;
  const queue: Array<{ sentence: string; audioPromise: Promise<ArrayBuffer | null> }> = [];

  const drainQueue = async () => {
    if (draining) return;
    draining = true;

    while (queue.length > 0) {
      if (activeSpeechId !== myId) {
        draining = false;
        return;
      }
      const nextItem = queue.shift()!;
      const buf = await nextItem.audioPromise;
      if (activeSpeechId !== myId) {
        draining = false;
        return;
      }
      if (!started) {
        started = true;
        callbacks?.onStart?.();
      }
      await playSentenceAudioBuffer(buf, nextItem.sentence, myId);
    }

    draining = false;
    if (finished && queue.length === 0 && activeSpeechId === myId) {
      callbacks?.onEnd?.();
    }
  };

  const enqueueSentence = (rawSegment: string) => {
    const cleaned = cleanMarkdownForSpeech(rawSegment);
    if (!cleaned || activeSpeechId !== myId) return;
    const audioPromise = fetchTtsSentenceBuffer(cleaned, voice, myId);
    queue.push({ sentence: cleaned, audioPromise });
    void drainQueue();
  };

  const flushCompleteSentences = () => {
    // Keep code blocks buffered until closed so we don't speak raw code mid-stream
    const openFences = (rawBuffer.match(/```/g) || []).length;
    if (openFences % 2 === 1) return;

    while (true) {
      const match = rawBuffer.match(/^([\s\S]*?(?:[.!?](?:\s+|\n+)|\n{2,}))([\s\S]*)$/);
      if (match) {
        const segment = match[1];
        rawBuffer = match[2];
        if (segment.trim().length >= 8) {
          enqueueSentence(segment);
          continue;
        } else {
          rawBuffer = segment + rawBuffer;
          break;
        }
      }

      if (rawBuffer.length >= 220) {
        const splitAt = rawBuffer.lastIndexOf(' ', 200);
        if (splitAt > 40) {
          const segment = rawBuffer.slice(0, splitAt);
          rawBuffer = rawBuffer.slice(splitAt + 1);
          enqueueSentence(segment);
          continue;
        }
      }
      break;
    }
  };

  return {
    push: (chunk: string) => {
      if (!chunk || activeSpeechId !== myId) return;
      rawBuffer += chunk;
      flushCompleteSentences();
    },
    finish: () => {
      if (activeSpeechId !== myId) return;
      finished = true;
      if (rawBuffer.trim()) {
        const tail = rawBuffer;
        rawBuffer = '';
        enqueueSentence(tail);
      } else if (!draining && queue.length === 0) {
        callbacks?.onEnd?.();
      }
    },
    cancel: () => {
      if (activeSpeechId === myId) {
        stopSpeechOutput();
      }
    },
  };
}
