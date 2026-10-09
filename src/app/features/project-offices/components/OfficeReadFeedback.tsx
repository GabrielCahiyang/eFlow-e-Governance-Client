import { useRef, useState } from 'react';
import { isSessionError } from '../../../shared/userFacingError';
import { projectOfficeReadError } from '../presentation';

/** Keep session recovery quiet while making failed reads explicitly retryable. */
export function OfficeReadFeedback({ errors, onRetry, busy = false }: {
  errors: (string | undefined)[]; onRetry: () => Promise<unknown>; busy?: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const pending = useRef(false);
  const error = projectOfficeReadError(errors.filter(Boolean), 'Could not load project Offices.');
  if (!error) return null;
  if (isSessionError(error)) return <p role="status" className="po-help">Updating Offices…</p>;
  const retry = async () => {
    if (busy || pending.current) return;
    pending.current = true; setRetrying(true);
    try { await onRetry(); } catch { /* The read owner retains its failure for another retry. */ }
    finally { pending.current = false; setRetrying(false); }
  };
  return <div role="alert" className="po-error">{error} <button disabled={busy || retrying} onClick={() => void retry()}>Retry</button></div>;
}
