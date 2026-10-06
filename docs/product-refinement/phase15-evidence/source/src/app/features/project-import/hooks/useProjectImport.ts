import { useEffect, useRef, useState } from 'react';
import { generateProjectDraft, importReviewedProject, importReviewedProjectWithOffices, ProjectImportSaveError } from '../services/projectImportService';
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
  const operation = useRef(false), committed = useRef(false), version = useRef(0);
  useEffect(() => { ++version.current; return () => { ++version.current; }; }, [projectId]);
  const current = (request: number) => request === version.current;
  const upload = async (file: File) => {
    if (operation.current || retryPending) return; operation.current = true; const request = version.current;
    setError(''); setBusy('reading');
    try { const text = await readProjectDocument(file); if (current(request)) { setSource(text); setSourceName(file.name); } }
    catch (e) { if (current(request)) setError(e instanceof Error ? e.message : 'Could not read this document.'); }
    finally { if (current(request)) { operation.current = false; setBusy(''); } }
  };
  const generate = async () => {
    if (operation.current || retryPending) return; operation.current = true; const request = version.current;
    setError(''); setBusy('generating'); setProgress('Checking your project document…');
    try {
      const next = await generateProjectDraft(projectId, source, sourceName, update => current(request) && setProgress(update.progress?.message || (update.status === 'queued' ? `Waiting for the AI. ${update.jobsAhead} jobs ahead.` : 'Preparing your draft…')));
      if (current(request)) { setDraft(next); setResult(null); committed.current = false; pending.current = null; }
    } catch (e) { if (current(request)) setError(e instanceof Error ? e.message : 'AI decomposition failed.'); }
    finally { if (current(request)) { operation.current = false; setBusy(''); } }
  };
  const save = async () => {
    if (operation.current || committed.current || !draft || result) return; operation.current = true; const request = version.current;
    setError('');
    try {
      if (!pending.current) pending.current = { id: crypto.randomUUID(), review: reviewedImportPayload(draft, sourceName, applyDetails) };
      setBusy('saving');
      const importReview = pending.current.review.offices.length ? importReviewedProjectWithOffices : importReviewedProject;
      const saved = await importReview(projectId, pending.current.id, pending.current.review);
      if (!current(request)) return;
      committed.current = true; setResult(saved); setRetryPending(false);
      try { onImported(); } catch { setError('Work was added. Refresh the project table to see the saved receipt; do not import again.'); }
    } catch (e) {
      if (!current(request)) return;
      if (e instanceof ProjectImportSaveError && !e.retrySameBatch) { pending.current = null; setRetryPending(false); }
      else if (pending.current) setRetryPending(true);
      setError(e instanceof Error ? e.message : 'Could not import this review.');
    } finally { if (current(request)) { operation.current = false; setBusy(''); } }
  };
  const newImport = () => {
    setDraft(null); setResult(null); committed.current = false; pending.current = null; setRetryPending(false);
    setSource(''); setSourceName('Project brief'); setApplyDetails(false); setError('');
  };
  return { source, setSource, sourceName, setSourceName, draft, setDraft, error, busy, progress, result, newImport,
    applyDetails, setApplyDetails, retryPending, operation, upload, generate, save };
}
