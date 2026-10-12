import { useCallback, useEffect, useRef, useState } from 'react';
import { assignTask, type Task } from '../../tasks';
import { fetchWorkTree, supportsNestedWork } from '../../nested-work';
import { fetchStaffingContext, parseStaffRecommendations, recommendStaff } from '../services/staffingService';
import type { StaffingContext, StaffRecommendation } from '../types';
export function useStaffingReview(task: Task, onAssigned?: () => void | Promise<void>, onClose?: () => void) {
  const [context, setContext] = useState<StaffingContext | null>(null), [rows, setRows] = useState<StaffRecommendation[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState(''), [selected, setSelected] = useState(''), [saved, setSaved] = useState(false), [assigning, setAssigning] = useState(false);
  const pending = useRef(false), savedReceipt = useRef(false), version = useRef(0);
  const [appointment, setAppointment] = useState<{leadId:string;version:number} | null>(null);
  const appointmentOpen = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current || savedReceipt.current || appointmentOpen.current) return;
    const request = version.current; pending.current = true; setLoading(true); setError('');
    try { const fresh = await fetchStaffingContext(task.id); if (request === version.current) { setContext(fresh); setRows([]); setSelected(id => fresh.candidates.some(person => person.id === id) ? id : ''); } }
    catch (reason) { if (request === version.current) { setContext(null); setError((reason as Error).message); } }
    finally { if (request === version.current) { pending.current = false; setLoading(false); } }
  }, [task.id]);
  useEffect(() => { ++version.current; pending.current = false; appointmentOpen.current = false; setAppointment(null); setBusy(false); setAssigning(false); setContext(null); setRows([]); setSelected(''); savedReceipt.current = false; setSaved(false); void refresh(); return () => { ++version.current; }; }, [refresh]);
  const generate = async () => {
    if (!context || pending.current || savedReceipt.current || appointmentOpen.current) return;
    const request = version.current; pending.current = true; setBusy(true); setError(''); setRows([]); setProgress('Joining the AI queue…');
    try { const fresh = await fetchStaffingContext(task.id); if (request !== version.current) return; setContext(fresh); const next = await recommendStaff(fresh, update => { if (request === version.current) setProgress(update.progress?.message || (update.status === 'queued' ? `Queued · ${update.jobsAhead} ahead` : 'Comparing confirmed professional profiles…')); }); if (request === version.current) setRows(next); }
    catch (reason) { if (request === version.current) setError((reason as Error).message || 'Generation failed. Retry or refresh eligible context.'); }
    finally { if (request === version.current) { pending.current = false; setBusy(false); setProgress(''); } }
  };
  const confirm = async (review: (person: string) => Promise<boolean>) => {
    const person = context?.candidates.find(candidate => candidate.id === selected);
    if (!person || pending.current || savedReceipt.current || appointmentOpen.current || !rows.some(row => row.userId === selected)) return;
    const request = version.current; pending.current = true; setBusy(true); setAssigning(true); setError('');
    try {
      if (!await review(person.name)) return;
      const fresh = await fetchStaffingContext(task.id); if (request !== version.current) return;
      setContext(fresh);
      const valid = parseStaffRecommendations(JSON.stringify({ recommendations: rows.map(row => ({ userId: row.userId, evidence: row.evidence })) }), fresh);
      setRows(valid);
      const eligible = fresh.candidates.find(candidate => candidate.id === selected);
      if (!eligible || !valid.some(row => row.userId === selected)) throw new Error('This recommendation is no longer eligible. Refresh context and review new recommendations.');
      if (supportsNestedWork(task)) {
        const tree = await fetchWorkTree(task.id); if (request !== version.current) return;
        if (tree.root.id !== task.id || tree.root.project !== task.linkedProjectId || tree.root.office !== task.orgId || tree.root.kind !== 'office') throw new Error('Could not verify the responsible Office and project for this recommendation.');
        if (!tree.people.some(person => person.id === eligible.id && person.eligible === true)) throw new Error('This person is not currently selected and eligible for this project. Ask the responsible Office Head to review Members, then refresh recommendations.');
        appointmentOpen.current = true; setAppointment({leadId:eligible.id,version:request});
        return;
      }
      await assignTask(task.id, eligible.id, eligible.name, { teamId: task.teamId, teamName: task.teamName, teamMemberIds: Array.from(new Set([...(task.teamMemberIds || []), eligible.id])) });
      if (request !== version.current) return;
      savedReceipt.current = true; setSaved(true);
      try { await onAssigned?.(); if (request === version.current) onClose?.(); } catch { if (request === version.current) setError('Owner assigned. Refresh the task to see the saved result; do not assign again.'); }
    } catch (reason) { if (request === version.current) setError((reason as Error).message || 'Assignment needs verification. Refresh eligible context before retrying.'); }
    finally { if (request === version.current) { pending.current = false; setBusy(false); setAssigning(false); } }
  };
  const cancelAppointment = () => { appointmentOpen.current = false; setAppointment(null); };
  const appointmentSaved = async () => {
    if (!appointment || appointment.version !== version.current || savedReceipt.current) return;
    // Called only after the canonical editor receives a checked save receipt.
    // Mark saved before refreshing callers so refresh failure cannot appoint twice.
    savedReceipt.current = true; setSaved(true);
    try { await onAssigned?.(); if (appointment.version === version.current) onClose?.(); }
    catch { if (appointment.version === version.current) setError('Lead appointed. Refresh the task to see the saved result; do not appoint again.'); throw new Error('Lead appointed, but the task could not refresh. Close and reload; do not appoint again.'); }
  };
  return { context, rows, loading, busy, error, progress, selected, setSelected, saved, assigning, pending, refresh, generate, confirm, appointment, cancelAppointment, appointmentSaved };
}
