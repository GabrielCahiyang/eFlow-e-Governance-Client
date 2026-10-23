import { useCallback, useEffect, useRef, useState } from 'react';
import { askHelp, transcribeHelp } from '../services/helpApi';
import { speechChunks } from '../services/speechChunks';
import { HandsFreeMicrophone } from '../services/handsFreeMicrophone';
import { LIVE_TURN_SILENCE_MS } from '../services/voiceActivity';
import { ProgressiveTranscription } from '../services/progressiveTranscription';
import { EMPTY_MICROPHONE } from '../types';
import type { ConversationStage, HelpMessage, HelpReply } from '../types';

export function useHelpConversation(scope: string, projectId: string, deviceId = '') {
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [stage, setStage] = useState<ConversationStage>('idle');
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [partialTranscript, setPartialTranscript] = useState(''), [signal, setSignal] = useState(EMPTY_MICROPHONE);
  const runtime = useRef({ epoch: 0, turnPending: false, microphone: null as HandsFreeMicrophone | null, transcriber: null as ProgressiveTranscription | null, request: null as AbortController | null, audio: null as HTMLAudioElement | null, audioUrl: '', history: [] as string[], muted: false, active: false });

  const silence = useCallback(() => {
    const state = runtime.current;
    if (state.audio) { state.audio.onended = null; state.audio.onerror = null; state.audio.pause(); state.audio.src = ''; state.audio = null; }
    if (state.audioUrl) { URL.revokeObjectURL(state.audioUrl); state.audioUrl = ''; }
  }, []);
  const dispose = useCallback(() => {
    const state = runtime.current; state.epoch++; state.active = false; state.turnPending = false;
    state.request?.abort(); state.request = null;
    state.transcriber?.cancel(); state.transcriber = null;
    state.microphone?.stop(); state.microphone = null; silence();
  }, [silence]);
  const stop = useCallback(() => { dispose(); setListening(false); setStage('idle'); setPartialTranscript(''); setSignal(EMPTY_MICROPHONE); }, [dispose]);
  useEffect(() => { setMessages([]); setStage('idle'); setListening(false); setError(''); runtime.current.history = []; return dispose; }, [scope, projectId, dispose]);
  useEffect(() => {
    const hide = () => { if (document.hidden && runtime.current.microphone) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [stop]);

  const resume = useCallback((epoch: number) => {
    if (runtime.current.epoch !== epoch) return;
    silence(); runtime.current.request = null; runtime.current.turnPending = false;
    setPartialTranscript('');
    runtime.current.microphone?.pause(!runtime.current.active);
    setStage(runtime.current.active ? 'listening' : 'idle');
  }, [silence]);

  const play = useCallback(async (reply: HelpReply, controller: AbortController, epoch: number, respectMute = false) => {
    setStage('preparing');
    for await (const blob of speechChunks(reply.replyId, controller.signal)) {
      if (runtime.current.epoch !== epoch || controller.signal.aborted) return;
      if (respectMute && runtime.current.muted) return;
      silence();
      const url = URL.createObjectURL(blob); runtime.current.audioUrl = url;
      const audio = new Audio(url); runtime.current.audio = audio;
      setStage('speaking');
      await new Promise<void>((resolve, reject) => {
        const aborted = () => { silence(); resolve(); };
        controller.signal.addEventListener('abort', aborted, { once: true });
        audio.onended = () => { controller.signal.removeEventListener('abort', aborted); resolve(); };
        audio.onerror = () => { controller.signal.removeEventListener('abort', aborted); reject(new Error('Audio playback failed. The written answer is still available.')); };
        void audio.play().catch(cause => { controller.signal.removeEventListener('abort', aborted); reject(cause); });
      });
      if (runtime.current.epoch !== epoch || controller.signal.aborted) return;
      setStage('preparing');
    }
  }, [silence]);

  const send = useCallback(async (text: string, audio?: Blob) => {
    const state = runtime.current;
    if (state.request || (!audio && !text.trim())) return;
    const epoch = state.epoch, controller = new AbortController(); state.request = controller; state.turnPending = false;
    state.microphone?.pause(true); setError('');
    try {
      let question = text.trim();
      if (audio) { setStage('transcribing'); question = (await transcribeHelp(audio, controller.signal)).text.trim(); }
      if (state.epoch !== epoch) return;
      if (!question) { resume(epoch); return; }
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', text: question }]);
      setStage('thinking');
      const reply = await askHelp(question, projectId, state.history, controller.signal, state.microphone ? 'live' : 'chat');
      if (state.epoch !== epoch) return;
      state.history = [...state.history, question].slice(-3);
      setMessages(current => [...current, { id: reply.replyId, role: 'assistant', text: reply.answer, reply }]);
      if (state.microphone && !state.muted) await play(reply, controller, epoch, true);
      resume(epoch);
    } catch (cause) {
      if (state.epoch !== epoch || controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'eFlow AI could not finish. Please try again.');
      // A failed turn should remain visible and keep Live available. A user
      // can speak again without reopening or silently losing the conversation.
      resume(epoch);
    }
  }, [projectId, play, resume]);

  const start = useCallback(async () => {
    if (runtime.current.active) return;
    if (runtime.current.microphone) {
      runtime.current.active = true; setListening(true);
      if (!runtime.current.request && !runtime.current.turnPending) { runtime.current.microphone.pause(false); setStage('listening'); }
      return;
    }
    if (runtime.current.request) return;
    const state = runtime.current, epoch = state.epoch;
    setError(''); setPartialTranscript(''); setSignal(EMPTY_MICROPHONE); state.active = true; setListening(true);
    state.transcriber = new ProgressiveTranscription({
      onText: text => setPartialTranscript(text),
      onFinal: text => {
        if (text) { setPartialTranscript(''); void send(text); }
        else { setError('No words were recognized. Check the microphone level and try again.'); resume(state.epoch); }
      },
      onError: (message, final) => { setError(message); if (final) resume(state.epoch); },
    });
    const microphone = new HandsFreeMicrophone(blob => { state.turnPending = true; setStage('transcribing'); state.transcriber?.push(blob, true); }, () => { setError('The microphone disconnected. You can restart voice or type.'); stop(); }, {
      deviceId, silenceMs: LIVE_TURN_SILENCE_MS, onPreview: blob => state.transcriber?.push(blob, false), onSignal: setSignal,
    });
    state.microphone = microphone;
    try { await microphone.start(); if (state.epoch === epoch) setStage(state.active ? 'listening' : 'idle'); }
    catch (cause) {
      if (state.epoch !== epoch) return;
      stop(); setError(cause instanceof Error ? cause.message : 'Microphone permission is needed for voice. You can still type.');
    }
  }, [send, stop, resume, deviceId]);

  // Pause controls input only. The accepted turn and its speech keep running.
  const pause = useCallback(() => {
    const state = runtime.current; state.active = false; setListening(false);
    state.microphone?.pause(true);
    if (!state.request && !state.turnPending) setStage('idle');
  }, []);

  const replay = useCallback(async (reply: HelpReply) => {
    if (runtime.current.request) return;
    const epoch = runtime.current.epoch, controller = new AbortController(); runtime.current.request = controller;
    runtime.current.microphone?.pause(true); setError('');
    try { await play(reply, controller, epoch); resume(epoch); }
    catch (cause) { if (runtime.current.epoch === epoch && !controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Replay failed.'); resume(epoch); } }
  }, [play, resume]);

  const interrupt = useCallback(() => {
    const state = runtime.current;
    state.epoch++; state.request?.abort(); state.request = null; state.turnPending = false;
    state.transcriber?.reset(); setPartialTranscript('');
    silence(); setError(''); state.microphone?.pause(!state.active);
    setStage(state.active ? 'listening' : 'idle');
  }, [silence]);

  const toggleMute = () => {
    const value = !runtime.current.muted; runtime.current.muted = value; setMuted(value);
    if (value && runtime.current.audio) { const audio = runtime.current.audio; audio.pause(); audio.onended?.(new Event('ended')); }
  };
  return { messages, stage, listening, muted, error, signal, partialTranscript, send, start, pause, stop, replay, interrupt, toggleMute, busy: !['idle', 'listening'].includes(stage) };
}
