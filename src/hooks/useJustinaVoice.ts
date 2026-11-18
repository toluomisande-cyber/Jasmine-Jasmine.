'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { useChatStore } from '../store/useChatStore';
import { LIVE_TOOL_DECLARATIONS, getLiveToolLabel } from '../lib/liveTools';
import { speakTextAloud, stopSpeechOutput } from '../utils/speechOutput';

export type VoiceOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

function downsampleTo16kInt16(float32: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  // Box-filter averaging resampler prevents aliasing when hardware sampleRate is 44.1kHz or 48kHz
  const ratio = inputSampleRate / 16000;
  const newLen = Math.floor(float32.length / ratio);
  const out = new Int16Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(float32.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += float32[j];
      count++;
    }
    const avg = count > 0 ? sum / count : float32[start] || 0;
    const s = Math.max(-1, Math.min(1, avg));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64PcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
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

  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const lastSpokenTextRef = useRef<string>('');
  const turnRoleRef = useRef<'user' | 'model' | null>(null);

  const stopAllPlayback = useCallback(() => {
    stopSpeechOutput();
    activeSourcesRef.current.forEach((src) => {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current.clear();
    if (playCtxRef.current) {
      nextPlayTimeRef.current = playCtxRef.current.currentTime;
    } else {
      nextPlayTimeRef.current = 0;
    }
  }, []);

  const schedulePcmAudio = useCallback((base64Pcm: string) => {
    if (!activeRef.current) return;
    if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      playCtxRef.current = new AudioCtx({ sampleRate: 24000 });
      nextPlayTimeRef.current = playCtxRef.current.currentTime;
    }
    const ctx = playCtxRef.current;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => { });
    }

    const float32 = base64PcmToFloat32(base64Pcm);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.015, nextPlayTimeRef.current);
    nextPlayTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(src);
    setOrbState('speaking');

    src.onended = () => {
      activeSourcesRef.current.delete(src);
      if (activeSourcesRef.current.size === 0 && activeRef.current) {
        setOrbState(mutedRef.current ? 'idle' : 'listening');
      }
    };
    src.start(startAt);
  }, []);

  const interruptSpeech = useCallback(() => {
    stopAllPlayback();
    if (activeRef.current) {
      setOrbState(mutedRef.current ? 'idle' : 'listening');
    }
  }, [stopAllPlayback]);

  const replayLastSpeech = useCallback(() => {
    const text = lastSpokenTextRef.current || "Hey! I'm Jasmine, and I'm listening.";
    setOrbState('speaking');
    void speakTextAloud(text, {
      voice: 'sabrina',
      onEnd: () => {
        if (activeRef.current) {
          setOrbState(mutedRef.current ? 'idle' : 'listening');
        }
      },
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (activeSourcesRef.current.size === 0) {
        setOrbState(next ? 'idle' : 'listening');
      }
      return next;
    });
  }, []);

  const testVoice = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: 'Say a short, warm 1-sentence audio check greeting as Jasmine.' }] }],
          turnComplete: true,
        });
        return;
      } catch {
        // fallback below
      }
    }
    replayLastSpeech();
  }, [replayLastSpeech]);

  useEffect(() => {
    if (!active) {
      stopAllPlayback();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (processorRef.current) {
        try {
          processorRef.current.disconnect();
        } catch { }
        processorRef.current = null;
      }
      if (captureCtxRef.current && captureCtxRef.current.state !== 'closed') {
        void captureCtxRef.current.close().catch(() => { });
        captureCtxRef.current = null;
      }
      if (playCtxRef.current && playCtxRef.current.state !== 'closed') {
        void playCtxRef.current.close().catch(() => { });
        playCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch { }
        sessionRef.current = null;
      }
      setOrbState('idle');
      setMicLevel(0);
      setErrorMessage(null);
      setLiveToolStatus(undefined);
      return;
    }

    let cancelled = false;

    const startLiveSession = async () => {
      try {
        setErrorMessage(null);
        setUserCaption('');
        setJustinaCaption('');
        setLiveToolStatus('Connecting live voice...');
        setOrbState('thinking');

        // 1. Start microphone & AudioContext
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
        if (!AudioCtx) {
          throw new Error('Web Audio API is not supported in this browser.');
        }

        let captureCtx: AudioContext;
        try {
          captureCtx = new AudioCtx({ sampleRate: 16000 });
        } catch {
          captureCtx = new AudioCtx();
        }
        captureCtxRef.current = captureCtx;
        if (captureCtx.state === 'suspended') {
          await captureCtx.resume();
        }

        const playCtx = new AudioCtx({ sampleRate: 24000 });
        playCtxRef.current = playCtx;
        if (playCtx.state === 'suspended') {
          await playCtx.resume();
        }
        nextPlayTimeRef.current = playCtx.currentTime;

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

        // 2. Fetch ephemeral token from server
        const tokenRes = await fetch('/api/live/token', { method: 'POST' });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData?.token) {
          throw new Error(tokenData?.error || 'Could not initialize Gemini Live session.');
        }
        if (cancelled) return;

        // 3. Build personalized system instruction with profile + memories
        const storeState = useChatStore.getState();
        const p = storeState.profile;
        const profileBits = [
          p.name ? `User name: ${p.name}` : '',
          p.role ? `Role: ${p.role}` : '',
          p.cityTimezone ? `City/Timezone: ${p.cityTimezone}` : '',
          p.communicationRules ? `Communication preferences: ${p.communicationRules}` : '',
        ].filter(Boolean);
        const memoryBits = storeState.memories.map((m) => `- ${m}`);

        const now = new Date();
        const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const clientLocalTime = now.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        });

        const systemInstruction = [
          'You are Jasmine, a warm, lively, natural female personal assistant on a real-time spoken voice call.',
          `Current local date & time (authoritative): ${clientLocalTime} (Timezone: ${clientTimeZone}, ISO: ${now.toISOString()}). Always use this for today, dates, times, and calendar scheduling.`,
          'Speak naturally and concisely (1 to 3 spoken sentences) like a sharp, friendly human.',
          'You have live tools: google_search, search_images, generate_image, browse_url, search_gmail, prepare_email, list_calendar_events, create_calendar_event, search_drive_files, list_tasks, create_task, save_memory, search_memory, and schedule_or_send_notification.',
          'Whenever the user shares personal facts or preferences, call save_memory automatically.',
          profileBits.length ? `User profile:\n${profileBits.join('\n')}` : '',
          memoryBits.length ? `Remembered facts:\n${memoryBits.join('\n')}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const ai = new GoogleGenAI({
          apiKey: tokenData.token,
          httpOptions: { apiVersion: 'v1alpha' },
        });

        const connectWithModel = async (modelId: string): Promise<Session> => {
          return ai.live.connect({
            model: modelId,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: tokenData.voiceName || 'Aoede',
                  },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction,
              tools: [{ functionDeclarations: LIVE_TOOL_DECLARATIONS }],
            },
            callbacks: {
              onopen: () => {
                if (cancelled) return;
                setLiveToolStatus(undefined);
                setOrbState(mutedRef.current ? 'idle' : 'listening');
              },
              onmessage: (msg: LiveServerMessage) => {
                if (cancelled) return;

                // Full-duplex barge-in interruption
                if (msg.serverContent?.interrupted) {
                  stopAllPlayback();
                  setOrbState(mutedRef.current ? 'idle' : 'listening');
                }

                // Live user speech transcription
                const inText = msg.serverContent?.inputTranscription?.text;
                if (inText) {
                  if (turnRoleRef.current !== 'user') {
                    turnRoleRef.current = 'user';
                    setUserCaption(inText);
                  } else {
                    setUserCaption((prev) => `${prev}${inText}`);
                  }
                }

                // Live model speech transcription
                const outText = msg.serverContent?.outputTranscription?.text;
                if (outText) {
                  if (turnRoleRef.current !== 'model') {
                    turnRoleRef.current = 'model';
                    lastSpokenTextRef.current = outText;
                    setJustinaCaption(outText);
                  } else {
                    setJustinaCaption((prev) => {
                      const next = `${prev}${outText}`;
                      lastSpokenTextRef.current = next;
                      return next;
                    });
                  }
                }

                if (msg.serverContent?.turnComplete) {
                  turnRoleRef.current = null;
                }

                // Incoming 24kHz native audio chunks
                const parts = msg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                  const inline = part.inlineData;
                  if (inline?.data && inline.mimeType?.startsWith('audio/pcm')) {
                    schedulePcmAudio(inline.data);
                  }
                }

                // Tool calls from Gemini Live
                const functionCalls = msg.toolCall?.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                  setOrbState('thinking');
                  void (async () => {
                    const responses: Array<{ id?: string; name: string; response: Record<string, unknown> }> = [];
                    for (const fc of functionCalls) {
                      const fcName = fc.name || '';
                      const fcArgs = (fc.args as Record<string, any>) || {};
                      setLiveToolStatus(getLiveToolLabel(fcName, fcArgs));
                      try {
                        const res = await fetch('/api/live/tool', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: fcName,
                            args: fcArgs,
                            memories: useChatStore.getState().memories,
                          }),
                        });
                        const data = await res.json();
                        if (data?.memorySaved) {
                          useChatStore.getState().addMemory(data.memorySaved);
                        }
                        if (data?.pendingAction) {
                          const store = useChatStore.getState();
                          const tid = store.activeThreadId || store.createThread('Voice Email Draft');
                          const existing = store.messagesByThread[tid] || [];
                          const draftMsg = {
                            id: `voice_draft_${Date.now()}`,
                            threadId: tid,
                            role: 'model' as const,
                            content: `Draft prepared for ${data.pendingAction.payload?.to || 'recipient'}.`,
                            status: 'complete' as const,
                            pendingAction: data.pendingAction,
                            createdAt: Date.now(),
                          };
                          useChatStore.setState((s) => ({
                            messagesByThread: {
                              ...s.messagesByThread,
                              [tid]: [...existing, draftMsg],
                            },
                          }));
                        }
                        responses.push({
                          id: fc.id,
                          name: fcName,
                          response: { result: data?.result ?? data },
                        });
                      } catch (toolErr: any) {
                        responses.push({
                          id: fc.id,
                          name: fcName,
                          response: { result: { error: toolErr?.message || 'Tool failed' } },
                        });
                      }
                    }

                    setLiveToolStatus(undefined);
                    if (!cancelled && sessionRef.current) {
                      sessionRef.current.sendToolResponse({ functionResponses: responses });
                    }
                  })();
                }
              },
              onerror: (err: any) => {
                if (cancelled) return;
                console.error('[useJustinaVoice] Live socket error:', err);
                setErrorMessage(err?.message || 'Live voice connection encountered an error.');
                setOrbState('error');
              },
              onclose: () => {
                if (!cancelled) {
                  setOrbState('idle');
                }
              },
            },
          });
        };

        let session: Session;
        try {
          session = await connectWithModel(
            tokenData.model || 'gemini-2.5-flash-native-audio-latest'
          );
        } catch (primaryErr) {
          console.warn('[useJustinaVoice] Primary live model failed, trying fallback:', primaryErr);
          session = await connectWithModel(
            tokenData.fallbackModel || 'gemini-2.5-flash-native-audio-preview-12-2025'
          );
        }

        if (cancelled) {
          session.close();
          return;
        }
        sessionRef.current = session;

        // Immediately greet the user so the seamless voice session starts talking right away
        try {
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: 'Greet the user warmly in one short natural spoken sentence as Jasmine and ask how you can help.',
                  },
                ],
              },
            ],
            turnComplete: true,
          });
        } catch {
          // ignore if session closed
        }

        // 4. Stream 16kHz Int16 PCM mic audio into Gemini Live
        const processor = captureCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        const zeroGain = captureCtx.createGain();
        zeroGain.gain.value = 0;

        processor.onaudioprocess = (e) => {
          if (cancelled || mutedRef.current || !sessionRef.current) return;
          const input = e.inputBuffer.getChannelData(0);
          const int16 = downsampleTo16kInt16(input, captureCtx.sampleRate);
          const base64 = int16ToBase64(int16);
          try {
            sessionRef.current.sendRealtimeInput({
              audio: {
                data: base64,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch {
            // ignore transient send errors on close
          }
        };

        source.connect(processor);
        processor.connect(zeroGain);
        zeroGain.connect(captureCtx.destination);
      } catch (err: any) {
        if (!cancelled) {
          setOrbState('error');
          setLiveToolStatus(undefined);
          setErrorMessage(err?.message || 'Unable to start Gemini Live voice session.');
        }
      }
    };

    void startLiveSession();

    return () => {
      cancelled = true;
    };
  }, [active, schedulePcmAudio, stopAllPlayback]);

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
