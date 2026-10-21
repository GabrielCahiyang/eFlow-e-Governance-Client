import { ActionMenu } from '../../../components/ui/workspace';
import { useRef } from 'react';
import { requestNavigation } from '../../../shared/navigationGuard';

/** Retained project workflows live in the content toolbar, separately from section visibility. */
export function ProjectWorkspaceActions({ canCreate, disabledReason, onCreate, onTemplates, onSavedPlans, onReviewPlans, onAllProjects, departmentFilter }: {
  canCreate: boolean; disabledReason?: string; onCreate: () => void;
  onTemplates: () => void; onSavedPlans: () => void; onReviewPlans: () => void; onAllProjects: () => void;
  departmentFilter?: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void };
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingDialog = useRef<(() => void) | null>(null);
  // Let the modal menu release its pointer/focus locks before a dialog acquires them.
  const queueDialog = (action: () => void) => { pendingDialog.current = action; };
  return <div className="eflow-project-workspace-actions">
    {canCreate && <ActionMenu trigger={<button ref={trigger} type="button" className="eflow-project-new">+ New</button>}
      onCloseAutoFocus={event => {
        const action = pendingDialog.current;
        pendingDialog.current = null;
        if (!action) return;
        event.preventDefault();
        trigger.current?.focus();
        requestAnimationFrame(() => { if (trigger.current?.isConnected) void requestNavigation(action); });
      }} actions={[
      ...(canCreate ? [{ id: 'project', label: 'Create project', onSelect: () => queueDialog(onCreate) },
        { id: 'templates', label: 'Use a project template', onSelect: () => queueDialog(onTemplates) }] : []),
    ]} />}
    {!canCreate && disabledReason && <><button type="button" className="eflow-project-new" disabled aria-describedby="project-create-reason">+ New</button><span id="project-create-reason" className="eflow-project-create-reason">{disabledReason}</span></>}
    <button type="button" className="eflow-project-view-trigger" onClick={onAllProjects}>All projects</button>
    <button type="button" className="eflow-project-view-trigger" onClick={onSavedPlans}>Saved work plans</button>
    <button type="button" className="eflow-project-view-trigger" onClick={onReviewPlans}>Proposal review</button>
    {departmentFilter && <label>Lead office <select aria-label="Filter plans and projects by office" value={departmentFilter.value} onChange={event => departmentFilter.onChange(event.target.value)}>
      {departmentFilter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>}
  </div>;
}
