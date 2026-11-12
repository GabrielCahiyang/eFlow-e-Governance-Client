import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { customStatusChoices, resolveStatus } from './statusDefinitions';
import { useWorkStatuses } from './WorkStatusProvider';

export interface WorkStatusTarget {
  taskId: string;
  subtaskId?: string;
  customId?: string | null;
  onChanged?: () => void | Promise<void>;
}

export function CustomWorkStatusSelect({ taskId, subtaskId, customId, onChanged }: WorkStatusTarget) {
  const { definitions } = useWorkStatuses();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = customStatusChoices(definitions, subtaskId ? 'subtask' : 'task');
  const current = definitions.find(item => item.id === customId);
  if (!options.length && !current) return null;

  async function change(value: string) {
    setBusy(true);
    setError('');
    try {
      const result = await supabase.rpc('set_work_custom_status', {
        p_task: taskId, p_subtask: subtaskId ?? null, p_status: value || null,
      });
      if (result.error) throw new Error(result.error.message);
      window.dispatchEvent(new CustomEvent('eflow:work-updated', { detail: { taskId } }));
      await onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update this status.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="work-status-choice">
    <label>In-progress label
      <select value={current?.id ?? ''} disabled={busy} onChange={event => void change(event.target.value)}>
        <option value="">{resolveStatus(definitions, 'in_progress', 'In progress').label}</option>
        {current && !options.some(item => item.id === current.id) &&
          <option value={current.id} disabled>{current.label} (unavailable for new work)</option>}
        {options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="work-state-error">{error}</p>}
  </div>;
}
