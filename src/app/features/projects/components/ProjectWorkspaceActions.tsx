import { requestNavigation } from '../../../shared/navigationGuard';

/** Retained project workflows live in the content toolbar, separately from section visibility. */
export function ProjectWorkspaceActions({ disabledReason, onTemplates, onSavedPlans, onAllProjects, departmentFilter }: {
  disabledReason?: string; onTemplates: () => void; onSavedPlans: () => void; onAllProjects: () => void;
  departmentFilter?: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void };
}) {
  return <div className="eflow-project-workspace-actions">
    <button type="button" className="eflow-project-view-trigger" onClick={onAllProjects}>All projects</button>
    <button type="button" className="eflow-project-view-trigger" onClick={onSavedPlans}>Saved work plans</button>
    <button type="button" className="eflow-project-view-trigger" onClick={() => void requestNavigation(onTemplates)}>Templates</button>
    {departmentFilter && <label>Lead office <select aria-label="Filter plans and projects by office" value={departmentFilter.value} onChange={event => departmentFilter.onChange(event.target.value)}>
      {departmentFilter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>}
    {disabledReason && <span className="eflow-project-create-reason">{disabledReason}</span>}
  </div>;
}
