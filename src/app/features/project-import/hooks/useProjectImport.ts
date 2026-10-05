import { useRef, useState } from 'react';
import { generateProjectDraft, importReviewedProject, ProjectImportSaveError } from '../services/projectImportService';
import { readProjectDocument } from '../services/documentService';
import { reviewedImportPayload } from '../selectors/draftValidation';
import type { ProjectImportDraft, ProjectImportResult } from '../types';

export function useProjectImport(projectId: string, onImported: () => void) {
  const [source, setSource] = useState(''), [sourceName, setSourceName] = useState('Project brief');
  const [draft, setDraft] = useState<ProjectImportDraft | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState<'reading' | 'generating' | 'saving' | ''>(''), [progress, setProgress] = useState('');
  const [result, setResult] = useState<ProjectImportResult | null>(null), [applyDetails, setApplyDetails] = useState(false);
  const pending = useRef<{ id: string; review: ReturnType<typeof reviewedImportPayload> } | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const upload = async (file: File) => {
    setError(''); setBusy('reading');
    try { setSource(await readProjectDocument(file)); setSourceName(file.name); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not read this document.'); }
    finally { setBusy(''); }
  };
  const generate = async () => {
    if (busy || retryPending) return;
    setError(''); setBusy('generating'); setProgress('Checking your project document…');
    try {
      const next = await generateProjectDraft(projectId, source, sourceName, update => setProgress(update.progress?.message || (update.status === 'queued' ? `Waiting for the AI. ${update.jobsAhead} jobs ahead.` : 'Preparing your draft…')));
      setDraft(next); setResult(null); pending.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : 'AI decomposition failed.'); }
    finally { setBusy(''); }
  };
  const save = async () => {
    if (busy || !draft || result) return;
    setError('');
    try {
      if (!pending.current) pending.current = { id: crypto.randomUUID(), review: reviewedImportPayload(draft, sourceName, applyDetails) };
      setBusy('saving');
      const saved = await importReviewedProject(projectId, pending.current.id, pending.current.review);
      setResult(saved); setRetryPending(false); onImported();
    } catch (e) {
      if (e instanceof ProjectImportSaveError && !e.retrySameBatch) { pending.current = null; setRetryPending(false); }
      else if (pending.current) setRetryPending(true);
      setError(e instanceof Error ? e.message : 'Could not import this review.');
    } finally { setBusy(''); }
  };
  const newImport = () => {
    setDraft(null); setResult(null); pending.current = null; setRetryPending(false);
    setSource(''); setSourceName('Project brief'); setApplyDetails(false); setError('');
  };
  return { source, setSource, sourceName, setSourceName, draft, setDraft, error, busy, progress, result, newImport,
    applyDetails, setApplyDetails, retryPending, upload, generate, save };
}
