import { ActionMenu } from '../../../components/ui/workspace';
import { useRef } from 'react';

/** Retained project workflows live in the content toolbar, separately from section visibility. */
export function ProjectWorkspaceActions({ canCreate, onCreate, onWorkPlan, onImport, onTemplates, onSavedPlans, onReviewPlans, departmentFilter }: {
  canCreate: boolean; onCreate: () => void; onWorkPlan: () => void; onImport: () => void;
  onTemplates: () => void; onSavedPlans: () => void; onReviewPlans: () => void;
  departmentFilter?: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void };
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingDialog = useRef<(() => void) | null>(null);
  // Let the modal menu release its pointer/focus locks before a dialog acquires them.
  const queueDialog = (action: () => void) => { pendingDialog.current = action; };
  return <div className="eflow-project-workspace-actions">
    <ActionMenu trigger={<button ref={trigger} type="button" className="eflow-workspace-navigation__destination">Projects and proposals</button>}
      onCloseAutoFocus={event => {
        const action = pendingDialog.current;
        pendingDialog.current = null;
        if (!action) return;
        event.preventDefault();
        trigger.current?.focus();
        requestAnimationFrame(() => { if (trigger.current?.isConnected) action(); });
      }} actions={[
      ...(canCreate ? [{ id: 'project', label: 'Create project', onSelect: () => queueDialog(onCreate) }, { id: 'workplan', label: 'Create a work plan', onSelect: () => queueDialog(onWorkPlan) },
        { id: 'import', label: 'Import proposal', onSelect: () => queueDialog(onImport) }, { id: 'templates', label: 'Use a project template', onSelect: () => queueDialog(onTemplates) }] : []),
      { id: 'saved', label: 'Saved work plans', onSelect: onSavedPlans }, { id: 'review', label: 'Proposal review', onSelect: onReviewPlans },
    ]} />
    {departmentFilter && <label>Lead office <select aria-label="Filter plans and projects by office" value={departmentFilter.value} onChange={event => departmentFilter.onChange(event.target.value)}>
      {departmentFilter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>}
  </div>;
}
