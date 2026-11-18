import { useRef, useState } from 'react';
import { usePendingAction } from '../../../shared/usePendingAction';
import { readableUiError } from '../../../shared/userFacingError';
import { recoverTaskEvidence, taskEvidenceActionKey, type TaskEvidenceAttempt } from '../services/taskEvidenceSubmission';

export function TaskEvidenceRecovery({ task, actor, verifyOnly, onSaved }: { task: string; actor: string; verifyOnly: boolean; onSaved?: () => void }) {
  const attempt = usePendingAction<TaskEvidenceAttempt>(taskEvidenceActionKey(actor, task));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  if (!attempt.value && !attempt.error) return null;

  async function check() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try { await recoverTaskEvidence(task, actor, verifyOnly); onSaved?.(); }
    catch (reason) { setError(readableUiError(reason, 'The saved submission could not be checked.', 'write')); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section aria-label="Saved evidence submission" className="space-y-2 rounded-md border p-3">
    {attempt.value && <button type="button" disabled={busy} onClick={() => void check()}>
      {busy ? 'Checking submission…' : 'Check saved evidence submission'}
    </button>}
    {(error || attempt.error) && <p role="alert">{error || attempt.error}</p>}
  </section>;
}
