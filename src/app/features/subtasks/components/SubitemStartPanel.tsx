import { readableUiError } from '../../../shared/userFacingError';
import { useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { startScheduledSubtask } from '../services/subtaskWorkflowService';
import { useConfirmation } from '../../../components/ui/useConfirmation';

export function SubitemStartPanel({ taskId, subtaskId, blockedReason, pending, recheck, onStarted }: {
  taskId: string;
  subtaskId: string;
  blockedReason: string | null;
  pending: boolean;
  recheck: () => Promise<void>;
  onStarted: () => Promise<void>;
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const { confirm, dialog } = useConfirmation();
  const current = useRef({pending, blockedReason});
  current.current = {pending, blockedReason};

  async function start() {
    if (pending || blockedReason || inFlight.current || started) return;
    inFlight.current = true;
    setError('');
    try {
      const accepted = await confirm({title: 'Start work?', description: 'Start this subtask now? Its current access and prerequisites will be checked again.', actionLabel: 'Start work'});
      if (!accepted) return;
      if (current.current.pending || current.current.blockedReason) throw new Error(current.current.blockedReason || 'Work is refreshing. Check again before starting.');
      setBusy(true);
      await recheck();
      await startScheduledSubtask(taskId, subtaskId);
      setStarted(true);
      window.dispatchEvent(new CustomEvent('eflow:work-updated', { detail: { taskId } }));
      await onStarted().catch(() => {});
    } catch (reason) {
      setError(readableUiError(reason, "Could not start this subtask. Try again.", 'write'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const startDisabledReason = busy ? 'Starting subtask…' : pending ? 'Waiting for work refresh…' : '';

  return <div className="space-y-2">
    {dialog}
    {started ? <p role="status">Subtask started. Reload this work if the update form does not appear.</p>
      : blockedReason ? <p role="status">{blockedReason}</p>
      : (
        <WorkspaceTooltip content={startDisabledReason} disabled={!startDisabledReason}>
          <span className="inline-flex">
            <Button disabled={pending || busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Start work'}</Button>
          </span>
        </WorkspaceTooltip>
      )}
    {error && <p role="alert">{error}</p>}
  </div>;
}
