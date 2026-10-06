import { useCallback, useEffect, useRef, useState } from 'react';
import { assignTask, type Task } from '../../tasks';
import { fetchStaffingContext, parseStaffRecommendations, recommendStaff } from '../services/staffingService';
import type { StaffingContext, StaffRecommendation } from '../types';
export function useStaffingReview(task: Task, onAssigned?: () => void, onClose?: () => void) {
  const [context, setContext] = useState<StaffingContext | null>(null), [rows, setRows] = useState<StaffRecommendation[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState(''), [selected, setSelected] = useState(''), [saved, setSaved] = useState(false), [assigning, setAssigning] = useState(false);
  const pending = useRef(false), savedReceipt = useRef(false), version = useRef(0);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const request = version.current; pending.current = true; setLoading(true); setError('');
    try { const fresh = await fetchStaffingContext(task.id); if (request === version.current) { setContext(fresh); setRows([]); setSelected(id => fresh.candidates.some(person => person.id === id) ? id : ''); } }
    catch (reason) { if (request === version.current) { setContext(null); setError((reason as Error).message); } }
    finally { if (request === version.current) { pending.current = false; setLoading(false); } }
  }, [task.id]);
  useEffect(() => { ++version.current; pending.current = false; setContext(null); setRows([]); setSelected(''); savedReceipt.current = false; setSaved(false); void refresh(); return () => { ++version.current; }; }, [refresh]);
  const generate = async () => {
    if (!context || pending.current || savedReceipt.current) return;
    const request = version.current; pending.current = true; setBusy(true); setError(''); setRows([]); setProgress('Joining the AI queue…');
    try { const fresh = await fetchStaffingContext(task.id); if (request !== version.current) return; setContext(fresh); const next = await recommendStaff(fresh, update => { if (request === version.current) setProgress(update.progress?.message || (update.status === 'queued' ? `Queued · ${update.jobsAhead} ahead` : 'Comparing confirmed professional profiles…')); }); if (request === version.current) setRows(next); }
    catch (reason) { if (request === version.current) setError((reason as Error).message || 'Generation failed. Retry or refresh eligible context.'); }
    finally { if (request === version.current) { pending.current = false; setBusy(false); setProgress(''); } }
  };
  const confirm = async (review: (person: string) => Promise<boolean>) => {
    const person = context?.candidates.find(candidate => candidate.id === selected);
    if (!person || pending.current || savedReceipt.current || !rows.some(row => row.userId === selected)) return;
    const request = version.current; pending.current = true; setBusy(true); setAssigning(true); setError('');
    try {
      if (!await review(person.name)) return;
      const fresh = await fetchStaffingContext(task.id); if (request !== version.current) return;
      setContext(fresh);
      const valid = parseStaffRecommendations(JSON.stringify({ recommendations: rows.map(row => ({ userId: row.userId, evidence: row.evidence })) }), fresh);
      setRows(valid);
      const eligible = fresh.candidates.find(candidate => candidate.id === selected);
      if (!eligible || !valid.some(row => row.userId === selected)) throw new Error('This recommendation is no longer eligible. Refresh context and review new recommendations.');
      await assignTask(task.id, eligible.id, eligible.name, { teamId: task.teamId, teamName: task.teamName, teamMemberIds: Array.from(new Set([...(task.teamMemberIds || []), eligible.id])) });
      if (request !== version.current) return;
      savedReceipt.current = true; setSaved(true);
      try { onAssigned?.(); onClose?.(); } catch { setError('Owner assigned. Refresh the task to see the saved result; do not assign again.'); }
    } catch (reason) { if (request === version.current) setError((reason as Error).message || 'Assignment needs verification. Refresh eligible context before retrying.'); }
    finally { if (request === version.current) { pending.current = false; setBusy(false); setAssigning(false); } }
  };
  return { context, rows, loading, busy, error, progress, selected, setSelected, saved, assigning, pending, refresh, generate, confirm };
}
