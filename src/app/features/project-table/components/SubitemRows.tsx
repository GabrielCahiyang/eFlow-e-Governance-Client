import {supportsNestedWork} from '../../nested-work';
import { useState } from 'react';
import { PanelRight } from 'lucide-react';
import { InlineEditableText } from '../../../components/ui/workspace';
import { TaskSubtasksWidget, createSubtask, updateSubtask, parentTaskDueDate, type Subtask } from '../../subtasks';
import { TASK_STATUS_LABELS, type Task } from '../../tasks';
import type { UserProfile } from '../../../types';
import { STATUS_COLORS } from '../selectors';
import { InlineCreateRow } from './InlineCreateRow';

interface SubitemRowsProps {
  task: Task;
  subtasks: Subtask[];
  columns: number;
  profiles: UserProfile[];
  canAdd: boolean;
  unavailableReason: string;
  onOpen: (subtask: Subtask) => void;
  onOpenTask: () => void;
  refresh: () => Promise<void>;
}

function LegacySubitemRows({ task, subtasks, columns, profiles, canAdd, unavailableReason, onOpen, onOpenTask, refresh }: SubitemRowsProps) {
  const parentDue = parentTaskDueDate(task.deadline, task.dueDate);
  const [dueDate, setDueDate] = useState(parentDue || '');
  const [busy, setBusy] = useState(false);

  return <tr className="pt-subitems-row"><td colSpan={columns}>
    <section id={'pt-subitems-' + task.id} className="pt-subitems" aria-label={'Subitems for ' + task.title}>
      <div className="pt-subitems-table-scroll"><table aria-label={task.title + ' subitems'}>
        <thead><tr>
          <th scope="col">Subitem</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Due date</th><th scope="col">Progress</th>
        </tr></thead>
        <tbody>
          {[...subtasks].sort((a, b) => a.position - b.position).map(subtask => {
            const ownerIds = [...new Set([subtask.assignedTo, ...subtask.assignedToIds].filter(Boolean))];
            const owners = ownerIds.map(id => profiles.find(profile => profile.id === id)?.full_name || 'Assigned person').join(', ');
            return <tr className="pt-subitem" key={subtask.id}>
              <td><div className="pt-subitem-name">
                <InlineEditableText value={subtask.title} label={'subitem ' + subtask.title} disabled={!canAdd || busy || subtask.status === 'completed'} onSave={async title => { await updateSubtask(subtask.id, { title }); await refresh(); }}/>
                <button type="button" aria-label={'Open subitem ' + subtask.title} onClick={() => onOpen(subtask)}><PanelRight size={15}/></button>
              </div></td>
              <td className="pt-subitem-owner" title={owners || 'Unassigned'}>{owners || 'Unassigned'}</td>
              <td className="pt-subitem-status" style={{ background: STATUS_COLORS[subtask.status] }}>{TASK_STATUS_LABELS[subtask.status]}</td>
              <td>{subtask.dueDate ? <time dateTime={subtask.dueDate}>{subtask.dueDate}</time> : 'No due date'}</td>
              <td>{subtask.percentComplete}%</td>
            </tr>;
          })}
          {!subtasks.length && !canAdd && <tr><td colSpan={5} className="pt-subitems-empty">No subitems yet.</td></tr>}
        </tbody>
      </table></div>
      {canAdd && <div className="pt-subitem-add">
        <InlineCreateRow autoFocus label={'Add subitem to ' + task.title} itemName="subitem" maxLength={200}
          onCreate={async title => {
            if (!canAdd) throw new Error(unavailableReason);
            return createSubtask(task.id, title, {
              position: Math.max(-1, ...subtasks.map(subtask => subtask.position)) + 1,
              ...(dueDate ? { dueDate } : {}),
            });
          }} onCreated={refresh} onBusyChange={setBusy}
          extraFields={saving => <input type="date" aria-label={'Due date for new subitem to ' + task.title}
            value={dueDate} max={parentDue} readOnly={saving} onChange={event => setDueDate(event.target.value)}/>} />
      </div>}
      {!canAdd && <div className="pt-subitems-access"><p>{unavailableReason}</p><button type="button" onClick={onOpenTask}>Task details</button></div>}
    </section>
  </td></tr>;
}


export function SubitemRows(props: SubitemRowsProps) {
 if(!supportsNestedWork(props.task))return <LegacySubitemRows {...props}/>;
 return <tr className="pt-subitems-row"><td colSpan={props.columns}><section className="pt-nested-work" id={'pt-subitems-'+props.task.id} aria-label={'Subitems for '+props.task.title}><TaskSubtasksWidget taskId={props.task.id} parentTask={props.task} canManage={props.canAdd} fallback={<table><tbody><LegacySubitemRows {...props}/></tbody></table>} allowedAssignees={props.profiles.map(p=>({id:p.id,name:p.full_name}))}/></section></td></tr>;
}
