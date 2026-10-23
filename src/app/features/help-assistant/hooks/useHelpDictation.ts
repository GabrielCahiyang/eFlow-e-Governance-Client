import { useCallback, useEffect, useRef, useState } from 'react';
import { HandsFreeMicrophone } from '../services/handsFreeMicrophone';
import { ProgressiveTranscription } from '../services/progressiveTranscription';
import { EMPTY_MICROPHONE } from '../types';

/** Replacement snapshots fill an editable draft; only Send asks the AI. */
export function useHelpDictation(scope: string, onText: (text: string) => void, deviceId = '') {
  const [stage, setStage] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [error, setError] = useState(''), [recognizing, setRecognizing] = useState(false);
  const [signal, setSignal] = useState(EMPTY_MICROPHONE);
  const runtime = useRef({ epoch: 0, microphone: null as HandsFreeMicrophone | null, transcriber: null as ProgressiveTranscription | null, heard: false, failed: false });
  const callback = useRef(onText); callback.current = onText;
  const dispose = useCallback(() => {
    const state = runtime.current; state.epoch++;
    state.microphone?.stop(); state.microphone = null;
    state.transcriber?.cancel(); state.transcriber = null;
  }, []);
  const cancel = useCallback(() => { dispose(); setStage('idle'); setRecognizing(false); setSignal(EMPTY_MICROPHONE); setError(''); }, [dispose]);
  useEffect(() => { setStage('idle'); setError(''); setSignal(EMPTY_MICROPHONE); return dispose; }, [scope, dispose]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [cancel]);
  const start = useCallback(async () => {
    const state = runtime.current;
    if (state.microphone || state.transcriber) return;
    const epoch = state.epoch; state.heard = false; state.failed = false;
    setError(''); setSignal(EMPTY_MICROPHONE); setStage('recording');
    state.transcriber = new ProgressiveTranscription({
      onText: text => { if (state.epoch === epoch) { if (text) { state.heard = true; state.failed = false; setError(''); } callback.current(text); } },
      onError: message => { if (state.epoch === epoch) { state.failed = true; setError(message); } },
      onBusy: busy => { if (state.epoch === epoch) setRecognizing(busy); },
    }, true);
    const microphone = new HandsFreeMicrophone(blob => {
      if (state.epoch !== epoch) return;
      state.transcriber?.push(blob, true);
      microphone.pause(false);
    }, () => { if (state.epoch === epoch) { cancel(); setError('The microphone disconnected. You can still type.'); } }, {
      deviceId,
      onPreview: blob => state.transcriber?.push(blob, false),
      onSignal: value => { if (state.epoch === epoch) setSignal(value); },
    });
    state.microphone = microphone;
    try { await microphone.start(); }
    catch (cause) { if (state.epoch === epoch) { cancel(); setError(cause instanceof Error ? cause.message : 'Microphone access is needed. You can still type.'); } }
  }, [cancel, deviceId]);
  const finish = async () => {
    const state = runtime.current, epoch = state.epoch;
    state.microphone?.finish(); state.microphone?.stop(); state.microphone = null;
    setStage('transcribing'); setSignal(EMPTY_MICROPHONE);
    await state.transcriber?.finish();
    if (state.epoch !== epoch) return;
    state.transcriber?.cancel(); state.transcriber = null; setStage('idle');
    if (!state.heard && !state.failed) setError('No speech was recognized. Check the microphone input level or choose a different input.');
  };
  return { stage, error, signal, recognizing, start, cancel, finish, busy: stage !== 'idle' };
}
