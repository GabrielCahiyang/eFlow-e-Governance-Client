import { useRef, useState } from 'react';
import { usePendingAction } from '../../../shared/usePendingAction';
import { readableUiError } from '../../../shared/userFacingError';
import {
  discardTaskEvidenceAttempt,
  recoverTaskEvidence,
  taskEvidenceActionKey,
  type TaskEvidenceAttempt,
} from '../services/taskEvidenceSubmission';

export function TaskEvidenceRecovery({ task, actor, verifyOnly, onSaved }: { task: string; actor: string; verifyOnly: boolean; onSaved?: () => void }) {
  const attempt = usePendingAction<TaskEvidenceAttempt>(taskEvidenceActionKey(actor, task));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'check' | 'discard' | null>(null);
  const inFlight = useRef(false);
  if (!attempt.value && !attempt.error) return null;

  async function check() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy('check');
    setError('');
    try { await recoverTaskEvidence(task, actor, verifyOnly); onSaved?.(); }
    catch (reason) { setError(readableUiError(reason, 'The saved submission could not be checked.', 'write')); }
    finally { inFlight.current = false; setBusy(null); }
  }

  async function discard() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy('discard');
    setError('');
    try {
      const outcome = await discardTaskEvidenceAttempt(task, actor);
      if (outcome === 'recovered') onSaved?.();
    } catch (reason) {
      setError(readableUiError(reason, 'The saved submission could not be cleared.', 'write'));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      aria-label="Saved evidence submission"
      className="space-y-2.5 rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950"
    >
      <div className="space-y-1">
        <p className="font-semibold text-amber-950">Unconfirmed submission attempt found</p>
        <p className="text-amber-900">
          An earlier submission did not finish confirming. Check whether it was already saved, or discard the unsent draft to submit fresh evidence below.
        </p>
      </div>
      {attempt.value && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void check()}
            className="inline-flex items-center rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {busy === 'check' ? 'Checking submission…' : 'Check saved evidence submission'}
          </button>
          {!verifyOnly && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void discard()}
              className="inline-flex items-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              {busy === 'discard' ? 'Discarding…' : 'Discard unsent draft'}
            </button>
          )}
        </div>
      )}
      {(error || attempt.error) && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-destructive">
          {error || attempt.error}
        </p>
      )}
    </section>
  );
}
