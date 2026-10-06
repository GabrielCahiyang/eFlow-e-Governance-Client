import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { ImportTask, ProposedOffice } from '../types';

export function ImportTaskReview({ tasks, allTasks, offices, disabled, onChange }: {
  tasks: ImportTask[]; allTasks: ImportTask[]; offices: ProposedOffice[]; disabled: boolean; onChange: (key: string, value: Partial<ImportTask>) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return <div className="pi-table-scroll"><table className="pi-review-table"><thead><tr><th scope="col">Include</th><th scope="col">Task and deliverable</th><th scope="col">Priority</th><th scope="col">Timeline</th><th scope="col">Hours</th><th scope="col">Proposed responsibility</th></tr></thead><tbody>
    {tasks.map(task => <Fragment key={task.key}>
      <tr className={!task.included ? 'pi-omitted' : ''}>
        <td><input type="checkbox" aria-label={`Include ${task.title}`} checked={task.included} disabled={disabled} onChange={e => onChange(task.key, { included: e.target.checked })}/></td>
        <td><input aria-label={`Task name ${task.key}`} value={task.title} maxLength={300} disabled={disabled} onChange={e => onChange(task.key, { title: e.target.value })}/><textarea aria-label={`Description ${task.key}`} value={task.description} rows={2} maxLength={10000} disabled={disabled} onChange={e => onChange(task.key, { description: e.target.value })}/>
          <button type="button" className="pi-details-button" aria-expanded={expanded.includes(task.key)} onClick={() => setExpanded(prev => prev.includes(task.key) ? prev.filter(k => k !== task.key) : [...prev, task.key])}>{expanded.includes(task.key) ? <ChevronDown size={15}/> : <ChevronRight size={15}/>} {task.subitems.length} subitems · dependencies · source</button></td>
        <td><select aria-label={`Priority ${task.key}`} value={task.priority} disabled={disabled} onChange={e => onChange(task.key, { priority: e.target.value as ImportTask['priority'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></td>
        <td className="pi-dates"><label>Start<input type="date" value={task.startDate} disabled={disabled} onChange={e => onChange(task.key, { startDate: e.target.value })}/></label><label>Due<input type="date" value={task.dueDate} disabled={disabled} onChange={e => onChange(task.key, { dueDate: e.target.value })}/></label></td>
        <td><input type="number" aria-label={`Hours ${task.key}`} value={task.estimatedHours} min={0} max={100000} disabled={disabled} onChange={e => onChange(task.key, { estimatedHours: Number(e.target.value) })}/></td>
        <td><select aria-label={`Office responsibility ${task.key}`} value={task.officeKey} disabled={disabled} onChange={e => onChange(task.key, { officeKey: e.target.value })}><option value="">No proposal</option>{offices.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}</select><small>People remain unassigned.</small></td>
      </tr>
      {expanded.includes(task.key) && <tr><td/><td colSpan={5}><div className="pi-expanded">
        <div className="pi-subitems"><strong>Subitems</strong>{task.subitems.map((subitem, index) => <div className="pi-subitem" key={index}>
          <input aria-label={`Subitem ${task.key} ${index+1}`} value={subitem.title} maxLength={300} disabled={disabled} onChange={e => onChange(task.key, { subitems: task.subitems.map((s, i) => i === index ? { ...s, title: e.target.value } : s) })}/>
          <input type="date" aria-label={`Subitem due ${task.key} ${index+1}`} value={subitem.dueDate} disabled={disabled} onChange={e => onChange(task.key, { subitems: task.subitems.map((s, i) => i === index ? { ...s, dueDate: e.target.value } : s) })}/>
          <button type="button" aria-label={`Remove subitem ${task.key} ${index+1}`} disabled={disabled} onClick={() => onChange(task.key, { subitems: task.subitems.filter((_, i) => i !== index) })}><Trash2 size={14}/></button>
        </div>)}<button type="button" disabled={disabled || task.subitems.length >= 30} onClick={() => onChange(task.key, { subitems: [...task.subitems, { title: '', dueDate: '' }] })}><Plus size={14}/>Add subitem</button></div>
        <div><label>Depends on<select multiple aria-label={`Dependencies ${task.key}`} value={task.dependencies} disabled={disabled} onChange={e => onChange(task.key, { dependencies: Array.from(e.target.selectedOptions, o => o.value) })}>{allTasks.filter(t => t.key !== task.key).map(t => <option key={t.key} value={t.key}>{t.title}{!t.included ? ' (omitted)' : ''}</option>)}</select></label><small>Use Ctrl / Cmd to select or clear dependencies.</small></div>
        <div className="pi-source-quote"><strong>Source evidence</strong><blockquote>{task.sourceQuote || 'AI suggestion; no verified quote. Check it against your source.'}</blockquote>{task.advisory && <details><summary>Routing and review suggestions</summary><p>{String(task.advisory.recommendationReasoning || 'Review required.')}</p></details>}</div>
      </div></td></tr>}
    </Fragment>)}
  </tbody></table></div>;
}
