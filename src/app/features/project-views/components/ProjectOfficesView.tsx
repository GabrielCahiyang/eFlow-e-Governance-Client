import { Building2 } from 'lucide-react';
import type { Task } from '../../tasks';
import type { Organization } from '../../../types';
import { officeTaskSummaries } from '../selectors';
import '../projectViews.css';

export function ProjectOfficesView({ tasks, offices, onSelectOffice, onOpenTask }: { tasks: Task[]; offices: Organization[]; onSelectOffice: (id: string) => void; onOpenTask: (id: string) => void }) {
  const rows = officeTaskSummaries(tasks);
  return <section aria-label="Project Offices" className="pv-offices"><div className="pv-view-heading"><div><h2>Offices</h2><p>Work owned by each Office in this project.</p></div></div>
    {!rows.length ? <p className="pv-empty">No Office work matches these filters.</p> : rows.map(row => <article key={row.officeId} className="pv-office-row"><header><Building2 size={19}/><h3>{offices.find(o => o.id === row.officeId)?.name || 'Office unavailable'}</h3>{row.officeId && <button onClick={() => onSelectOffice(row.officeId)}>View tasks</button>}</header>
      <div className="pv-office-metrics"><span><strong>{row.total}</strong>Tasks</span><span><strong>{row.completed}</strong>Completed</span><span><strong>{row.active}</strong>Active</span><span><strong>{row.overdue}</strong>Overdue</span></div>
      <progress aria-label="Office completion" value={row.completed} max={Math.max(1, row.total)}/>
      <details><summary>Task list</summary>{row.tasks.map(task => <button key={task.id} onClick={() => onOpenTask(task.id)}>{task.title}<span>{task.status.replace(/_/g, ' ')}</span></button>)}</details>
    </article>)}
  </section>;
}
