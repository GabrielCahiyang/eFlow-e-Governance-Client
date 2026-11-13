import { useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { startScheduledSubtask } from '../services/subtaskWorkflowService';

export function SubitemStartPanel({ taskId, subtaskId, blockedReason, pending, onStarted }: {
  taskId: string;
  subtaskId: string;
  blockedReason: string | null;
  pending: boolean;
  onStarted: () => Promise<void>;
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  async function start() {
    if (pending || blockedReason || inFlight.current || started) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await startScheduledSubtask(taskId, subtaskId);
      setStarted(true);
      window.dispatchEvent(new CustomEvent('eflow:work-updated', { detail: { taskId } }));
      await onStarted().catch(() => {});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start this subtask. Try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="space-y-2">
    {started ? <p role="status">Subtask started. Reload this work if the update form does not appear.</p>
      : blockedReason ? <p role="status">{blockedReason}</p>
      : <Button disabled={pending || busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Start work'}</Button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
