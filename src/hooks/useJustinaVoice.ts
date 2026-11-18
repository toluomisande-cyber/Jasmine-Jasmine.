'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';
import {
  cleanMarkdownForSpeech,
  getUnlockedVoiceAudioElement,
  pickDefaultSpeechVoice,
  stopSpeechOutput,
} from '../utils/speechOutput';

export type VoiceOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function useJustinaVoice(active: boolean) {
  const [orbState, setOrbState] = useState<VoiceOrbState>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [userCaption, setUserCaption] = useState('');
  const [justinaCaption, setJustinaCaption] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveToolStatus, setLiveToolStatus] = useState<string | undefined>(undefined);

  const activeRef = useRef(active);
  activeRef.current = active;

  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const orbStateRef = useRef<VoiceOrbState>('idle');
  const updateOrbState = useCallback((next: VoiceOrbState) => {
    orbStateRef.current = next;
    setOrbState(next);
  }, []);

  // Unlocked reusable HTMLAudioElement + active Blob URL + AbortController for /api/tts
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const playbackIdRef = useRef(0);
  const lastSpokenTextRef = useRef<string>('');

  // Mic visualizer stream + Web Audio analyser
  const streamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Continuous SpeechRecognition + turn commit state
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionRunningRef = useRef(false);
  const pendingTranscriptRef = useRef('');
  const silenceTimerRef = useRef<number | null>(null);
  const processingTurnRef = useRef(false);

  const getOrInitAudioElement = useCallback((): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null;
    if (!audioElRef.current) {
      audioElRef.current = getUnlockedVoiceAudioElement() || new Audio();
    }
    return audioElRef.current;
  }, []);

  const revokeActiveBlobUrl = useCallback(() => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      recognitionRunningRef.current = false;
      rec.stop();
    } catch {
      // ignore if already stopped
    }
  }, []);

  const startRecognitionIfListening = useCallback(() => {
    if (!activeRef.current || mutedRef.current || processingTurnRef.current) return;
    if (orbStateRef.current === 'speaking' || orbStateRef.current === 'thinking') return;
    const rec = recognitionRef.current;
    if (!rec || recognitionRunningRef.current) return;
    try {
      recognitionRunningRef.current = true;
      rec.start();
    } catch {
      recognitionRunningRef.current = false;
    }
  }, []);

  const stopAllPlayback = useCallback(() => {
    playbackIdRef.current += 1;

    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }

    const audio = audioElRef.current || getUnlockedVoiceAudioElement();
    if (audio) {
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore audio reset errors
      }
    }

    revokeActiveBlobUrl();
    stopSpeechOutput();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }, [revokeActiveBlobUrl]);

  const finishSpeakingAndListen = useCallback(
    (myPlaybackId: number) => {
      if (playbackIdRef.current !== myPlaybackId) return;
      revokeActiveBlobUrl();
      if (!activeRef.current) return;
      const nextState: VoiceOrbState = mutedRef.current ? 'idle' : 'listening';
      updateOrbState(nextState);
      if (nextState === 'listening') {
        window.setTimeout(() => {
          startRecognitionIfListening();
        }, 120);
      }
    },
    [revokeActiveBlobUrl, startRecognitionIfListening, updateOrbState]
  );

  const speakWithBrowserFallback501 = useCallback(
    (spokenText: string, myPlaybackId: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        finishSpeakingAndListen(myPlaybackId);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        const voices = window.speechSynthesis.getVoices();
        const voice = pickDefaultSpeechVoice(voices);
        if (voice) {
          utterance.voice = voice;
        } else {
          utterance.lang = 'en-US';
        }
        utterance.rate = 1.02;
        utterance.pitch = 1.02;
        utterance.onend = () => finishSpeakingAndListen(myPlaybackId);
        utterance.onerror = () => finishSpeakingAndListen(myPlaybackId);
        updateOrbState('speaking');
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        finishSpeakingAndListen(myPlaybackId);
      }
    },
    [finishSpeakingAndListen, updateOrbState]
  );

  const speakWithFishTts = useCallback(
    async (rawText: string) => {
      const spoken = cleanMarkdownForSpeech(rawText);
      if (!spoken || !activeRef.current) {
        if (activeRef.current) {
          updateOrbState(mutedRef.current ? 'idle' : 'listening');
          startRecognitionIfListening();
        }
        return;
      }

      stopAllPlayback();
      stopRecognition();

      const myPlaybackId = ++playbackIdRef.current;
      lastSpokenTextRef.current = rawText;

      const controller = new AbortController();
      ttsAbortRef.current = controller;

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: spoken }),
          signal: controller.signal,
        });

        if (playbackIdRef.current !== myPlaybackId || !activeRef.current) return;

        // Fall back to window.speechSynthesis only if /api/tts returns 501
        if (res.status === 501) {
          speakWithBrowserFallback501(spoken, myPlaybackId);
          return;
        }

        if (!res.ok) {
          throw new Error(`Fish Audio TTS returned ${res.status}`);
        }

        const audioBlob = await res.blob();
        if (playbackIdRef.current !== myPlaybackId || !activeRef.current) return;

        const mpegBlob =
          audioBlob.type === 'audio/mpeg'
            ? audioBlob
            : new Blob([audioBlob], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(mpegBlob);
        activeBlobUrlRef.current = blobUrl;

        const audio = getOrInitAudioElement();
        if (!audio) {
          URL.revokeObjectURL(blobUrl);
          activeBlobUrlRef.current = null;
          finishSpeakingAndListen(myPlaybackId);
          return;
        }

        audio.volume = 1;
        audio.src = blobUrl;
        updateOrbState('speaking');

        audio.onended = () => {
          if (activeBlobUrlRef.current === blobUrl) {
            URL.revokeObjectURL(blobUrl);
            activeBlobUrlRef.current = null;
          }
          finishSpeakingAndListen(myPlaybackId);
        };

        audio.onerror = () => {
          if (activeBlobUrlRef.current === blobUrl) {
            URL.revokeObjectURL(blobUrl);
            activeBlobUrlRef.current = null;
          }
          finishSpeakingAndListen(myPlaybackId);
        };

        await audio.play();
      } catch (err: any) {
        if (err?.name === 'AbortError' || playbackIdRef.current !== myPlaybackId) {
          return;
        }
        console.warn('[useJustinaVoice] Fish Audio TTS playback error:', err);
        finishSpeakingAndListen(myPlaybackId);
      }
    },
    [
      finishSpeakingAndListen,
      getOrInitAudioElement,
      speakWithBrowserFallback501,
      startRecognitionIfListening,
      stopAllPlayback,
      stopRecognition,
      updateOrbState,
    ]
  );

  const handleUserTurn = useCallback(
    async (transcriptText: string) => {
      const cleanedUserText = transcriptText.trim();
      if (!cleanedUserText || !activeRef.current || processingTurnRef.current) return;

      processingTurnRef.current = true;
      pendingTranscriptRef.current = '';
      stopRecognition();
      stopAllPlayback();

      setUserCaption(cleanedUserText);
      setJustinaCaption('');
      setLiveToolStatus('Thinking...');
      updateOrbState('thinking');

      // Mirror streaming reply text and tool status into the Voice Overlay while sendMessage runs
      const unsub = useChatStore.subscribe((state) => {
        if (!activeRef.current) return;
        const tid = state.activeThreadId;
        if (!tid) return;
        const list = state.messagesByThread[tid] || [];
        const latest = list[list.length - 1];
        if (latest && latest.role === 'model') {
          if (latest.toolStatus) {
            setLiveToolStatus(latest.toolStatus);
          }
          if (latest.content) {
            setJustinaCaption(latest.content);
          }
        }
      });

      try {
        const replyMsg = await useChatStore
          .getState()
          .sendMessage(cleanedUserText, undefined, { voiceMode: true });

        unsub();
        setLiveToolStatus(undefined);

        if (!activeRef.current) {
          processingTurnRef.current = false;
          return;
        }

        const replyText =
          replyMsg?.content?.trim() ||
          "I heard you, could you say that one more time?";
        setJustinaCaption(replyText);
        processingTurnRef.current = false;
        await speakWithFishTts(replyText);
      } catch (err: any) {
        unsub();
        setLiveToolStatus(undefined);
        processingTurnRef.current = false;
        if (activeRef.current) {
          updateOrbState(mutedRef.current ? 'idle' : 'listening');
          startRecognitionIfListening();
        }
      }
    },
    [speakWithFishTts, startRecognitionIfListening, stopAllPlayback, stopRecognition, updateOrbState]
  );

  const interruptSpeech = useCallback(() => {
    stopAllPlayback();
    processingTurnRef.current = false;
    setLiveToolStatus(undefined);
    if (activeRef.current) {
      const nextState: VoiceOrbState = mutedRef.current ? 'idle' : 'listening';
      updateOrbState(nextState);
      if (nextState === 'listening') {
        startRecognitionIfListening();
      }
    }
  }, [startRecognitionIfListening, stopAllPlayback, updateOrbState]);

  const replayLastSpeech = useCallback(() => {
    const text =
      lastSpokenTextRef.current ||
      justinaCaption ||
      "Hey! I'm Jasmine, and I'm listening.";
    setJustinaCaption(text);
    void speakWithFishTts(text);
  }, [justinaCaption, speakWithFishTts]);

  const testVoice = useCallback(() => {
    const sample =
      lastSpokenTextRef.current ||
      "Hey there! I'm Jasmine, speaking with my custom Fish Audio voice.";
    setJustinaCaption(sample);
    void speakWithFishTts(sample);
  }, [speakWithFishTts]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (next) {
        stopRecognition();
        if (orbStateRef.current === 'listening') {
          updateOrbState('idle');
        }
      } else {
        if (orbStateRef.current === 'idle') {
          updateOrbState('listening');
          window.setTimeout(() => {
            startRecognitionIfListening();
          }, 80);
        }
      }
      return next;
    });
  }, [startRecognitionIfListening, stopRecognition, updateOrbState]);

  useEffect(() => {
    if (!active) {
      stopRecognition();
      stopAllPlayback();
      processingTurnRef.current = false;
      pendingTranscriptRef.current = '';

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (captureCtxRef.current && captureCtxRef.current.state !== 'closed') {
        void captureCtxRef.current.close().catch(() => {});
        captureCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      recognitionRef.current = null;
      recognitionRunningRef.current = false;
      updateOrbState('idle');
      setMicLevel(0);
      setErrorMessage(null);
      setLiveToolStatus(undefined);
      return;
    }

    let cancelled = false;

    const startVoiceSession = async () => {
      try {
        setErrorMessage(null);
        setUserCaption('');
        setJustinaCaption('');
        setLiveToolStatus(undefined);

        // Prime unlocked HTMLAudioElement reference
        getOrInitAudioElement();

        // 1. Open microphone stream for audio-reactive orb visualization
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone access is not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const captureCtx = new AudioCtx();
          captureCtxRef.current = captureCtx;
          if (captureCtx.state === 'suspended') {
            await captureCtx.resume().catch(() => {});
          }
          const source = captureCtx.createMediaStreamSource(stream);
          const analyser = captureCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const tickLevel = () => {
            if (cancelled) return;
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const v = (dataArray[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setMicLevel(mutedRef.current ? 0 : Math.min(1, rms * 3.5));
            rafRef.current = requestAnimationFrame(tickLevel);
          };
          rafRef.current = requestAnimationFrame(tickLevel);
        }

        // 2. Setup continuous browser SpeechRecognition for hands-free user turns
        const SpeechRecCtor =
          (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
            .webkitSpeechRecognition;

        if (SpeechRecCtor) {
          const rec = new SpeechRecCtor();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (event: SpeechRecognitionEventLike) => {
            if (cancelled || mutedRef.current || processingTurnRef.current) return;
            if (orbStateRef.current === 'speaking' || orbStateRef.current === 'thinking') return;

            let combined = '';
            let hasFinal = false;
            for (let i = 0; i < event.results.length; i++) {
              const res = event.results[i];
              const chunk = res[0]?.transcript || '';
              combined += chunk;
              if (res.isFinal) {
                hasFinal = true;
              }
            }

            const cleaned = combined.trim();
            if (!cleaned) return;

            pendingTranscriptRef.current = cleaned;
            setUserCaption(cleaned);

            if (silenceTimerRef.current) {
              window.clearTimeout(silenceTimerRef.current);
            }

            // Commit turn after natural pause (faster when final segment detected)
            const waitMs = hasFinal ? 750 : 1350;
            silenceTimerRef.current = window.setTimeout(() => {
              const toSend = pendingTranscriptRef.current.trim();
              if (toSend && activeRef.current && !processingTurnRef.current) {
                void handleUserTurn(toSend);
              }
            }, waitMs);
          };

          rec.onerror = (e) => {
            if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
              setErrorMessage('Microphone speech recognition permission was denied.');
              updateOrbState('error');
            }
          };

          rec.onend = () => {
            recognitionRunningRef.current = false;
            if (cancelled || !activeRef.current) return;
            // If user stopped speaking and recognition ended with pending text, commit it
            const leftover = pendingTranscriptRef.current.trim();
            if (
              leftover &&
              !processingTurnRef.current &&
              orbStateRef.current === 'listening'
            ) {
              if (silenceTimerRef.current) {
                window.clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
              void handleUserTurn(leftover);
              return;
            }
            // Otherwise automatically restart recognition if still in listening mode
            if (
              !mutedRef.current &&
              !processingTurnRef.current &&
              orbStateRef.current === 'listening'
            ) {
              window.setTimeout(() => {
                startRecognitionIfListening();
              }, 150);
            }
          };

          recognitionRef.current = rec;
        }

        // 3. Greet the user immediately using Jasmine's Fish Audio voice (5bac2db6b75b400d9a0f2c257a6da812)
        const userName = useChatStore.getState().profile?.name?.trim();
        const greeting = userName
          ? `Hey ${userName}! I'm Jasmine—what's on your mind?`
          : "Hey! I'm Jasmine, nice to meet you. How can I help you today?";
        setJustinaCaption(greeting);
        await speakWithFishTts(greeting);
      } catch (err: any) {
        if (!cancelled) {
          updateOrbState('error');
          setLiveToolStatus(undefined);
          setErrorMessage(err?.message || 'Unable to start Jasmine voice session.');
        }
      }
    };

    void startVoiceSession();

    return () => {
      cancelled = true;
    };
  }, [
    active,
    getOrInitAudioElement,
    handleUserTurn,
    speakWithFishTts,
    startRecognitionIfListening,
    stopAllPlayback,
    stopRecognition,
    updateOrbState,
  ]);

  return {
    orbState,
    micLevel,
    muted,
    ttsSupported: true,
    userCaption,
    justinaCaption,
    errorMessage,
    liveToolStatus,
    toggleMute,
    interruptSpeech,
    replayLastSpeech,
    testVoice,
  };
}
