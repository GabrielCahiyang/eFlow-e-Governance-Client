import { useMemo, useRef, useState } from 'react';
import { CalendarDays, Link2, Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task } from '../../tasks';
import { isOverdue } from '../../tasks';
import { STATUS_COLORS } from '../../project-table';
import type { ProjectCommandData } from '../../projects';
import { calendarDay, dayString, scheduledTaskRows, shiftedTaskDates, longestDependencyChain } from '../selectors';
import { useProjectViewActions } from '../hooks/useProjectViewActions';
import { TaskDatesDialog } from './TaskDatesDialog';
import '../projectViews.css';

const ROW = 52, LABEL = 240, HEADER = 48;
type Drag = { task: Task; origin: number; days: number; edge: 'move' | 'start' | 'end' };
export function ProjectGanttView({ data, allTasks, canManage, onOpenTask, onOpenPlan }: { data: ProjectCommandData; allTasks: Task[]; canManage: boolean; onOpenTask: (id: string) => void; onOpenPlan: () => void }) {
  const actions = useProjectViewActions(data.project, canManage);
  const [scale, setScale] = useState<'day' | 'week' | 'month'>('week');
  const [highlight, setHighlight] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const moved = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => scheduledTaskRows(data.tasks), [data.tasks]);
  const milestones = data.milestones.flatMap(m => { const day = calendarDay(m.dueDate); return day === null ? [] : [{ ...m, day }]; });
  const projectDates = [calendarDay(data.project.startDate), calendarDay(data.project.targetDate)].filter((d): d is number => d !== null);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
  const dates = [...rows.flatMap(r => [r.start, r.end]), ...milestones.map(m => m.day), ...projectDates];
  const min = Math.min(...(dates.length ? dates : [today])) - 3, max = Math.max(...(dates.length ? dates : [today + 14])) + 4;
  const px = scale === 'day' ? 48 : scale === 'week' ? 24 : 8;
  const width = Math.max(600, (max - min + 1) * px), height = (rows.length + milestones.length) * ROW;
  const tickStep = Math.max(scale === 'day' ? 1 : scale === 'week' ? 7 : 30, Math.ceil((max - min) / 160));
  const ticks = Array.from({ length: Math.ceil((max - min + 1) / tickStep) }, (_, i) => min + i * tickStep);
  const chain = useMemo(() => longestDependencyChain(allTasks), [allTasks]);
  const unscheduled = data.tasks.filter(t => !rows.some(r => r.task.id === t.id));
  const x = (day: number) => (day - min) * px;
  const begin = (event: React.PointerEvent, task: Task, edge: Drag['edge']) => {
    if (event.button !== 0 || actions.busy || !actions.canEditDates(task)) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); moved.current = false;
    setDrag({ task, origin: event.clientX, days: 0, edge });
  };
  const finish = () => {
    if (!drag) return;
    const pending = drag; setDrag(null);
    if (!pending.days) return;
    moved.current = true;
    void actions.run(async () => actions.saveDates(pending.task, shiftedTaskDates(pending.task, pending.days, pending.edge)));
  };
  const jump = () => scroller.current?.scrollTo({ left: Math.max(0, LABEL + x(today) - 350), behavior: 'smooth' });
  return <section className="pv-gantt" aria-label="Project Gantt">
    <div className="pv-view-heading"><div><h2>Gantt</h2><p>{rows.length} scheduled tasks · {milestones.length} milestones · {unscheduled.length} without a valid due date</p></div><div className="pv-view-actions">
      <select aria-label="Gantt scale" value={scale} onChange={e => setScale(e.target.value as typeof scale)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select>
      <button onClick={() => scroller.current?.scrollBy({ left: -300, behavior: 'smooth' })} aria-label="Earlier dates"><ChevronLeft size={16}/></button><button onClick={jump}>Today</button><button onClick={() => scroller.current?.scrollBy({ left: 300, behavior: 'smooth' })} aria-label="Later dates"><ChevronRight size={16}/></button>
      <button aria-pressed={highlight} onClick={() => setHighlight(!highlight)} disabled={!chain.length}><Link2 size={15}/>Longest dependency chain</button><button onClick={onOpenPlan}>Manage plan</button>
    </div></div>
    <p className="pv-help">Drag a permitted task to move its dates; use the edge handles to resize. Tasks with only a due date appear as date markers.</p>
    {highlight && <p className="pv-help">Highlighted: the longest chain by recorded task durations. Resource constraints and missing dates are not included.</p>}
    {actions.notice && <p className="pv-error" role="alert">{actions.notice}</p>}
    <div className="pv-gantt-scroll" ref={scroller} aria-busy={actions.busy}>
      <div className="pv-gantt-sheet" style={{ width: width + LABEL, minHeight: HEADER + height }}>
        <div className="pv-gantt-header" style={{ height: HEADER }}><span style={{ width: LABEL }}>Task / milestone</span><div style={{ width }}>{ticks.map(day => <span key={day} style={{ left: x(day) }}>{new Date(day * 86400000).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })}</span>)}</div></div>
        <div className="pv-gantt-axis" style={{ left: LABEL, width, top: HEADER, height }}>
          {ticks.map(day => <i key={day} style={{ left: x(day) }}/>) }{today >= min && today <= max && <i className="pv-today-line" style={{ left: x(today) }} aria-label="Today"/>}
          <svg className="pv-dependencies" width={width} height={height} aria-label="Task dependencies"><defs><marker id="pv-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6" fill="#7b8495"/></marker></defs>
            {rows.flatMap((row, index) => (row.task.dependencyIds || []).flatMap(id => { const previous = rows.findIndex(r => r.task.id === id); if (previous < 0) return []; const from = x(rows[previous].end + 1), to = x(row.start), y1 = previous * ROW + ROW / 2, y2 = index * ROW + ROW / 2, elbow = Math.max(from + 12, to - 12); return <path key={id + row.task.id} d={`M${from},${y1} H${elbow} V${y2} H${to}`} markerEnd="url(#pv-arrow)" fill="none" stroke={highlight && chain.includes(id) && chain.includes(row.task.id) ? '#d9485c' : '#7b8495'} strokeWidth="1.5"><title>{rows[previous].task.title} → {row.task.title}{rows[previous].end >= row.start ? ' · schedule overlap' : ''}</title></path>; }))}
          </svg>
        </div>
        {rows.map((row, index) => {
          let start = row.start, end = row.end;
          if (drag?.task.id === row.task.id) { if (drag.edge !== 'end' && !row.point) start += drag.days; if (drag.edge !== 'start') end += drag.days; if (row.point) start = end; }
          const editable = actions.canEditDates(row.task) && !actions.busy;
          const overdue = !['completed', 'cancelled'].includes(row.task.status) && isOverdue(row.task);
          return <div className="pv-gantt-row" key={row.task.id} style={{ top: HEADER + index * ROW, width: width + LABEL }}>
            <div className="pv-gantt-label" style={{ width: LABEL }}><button onClick={() => onOpenTask(row.task.id)} title={row.task.title}>{overdue && <span className="pv-late" aria-label="Overdue">!</span>}{row.task.title}</button><button disabled={!editable} onClick={() => setEditing(row.task)} aria-label={'Edit dates for ' + row.task.title}><CalendarDays size={15}/></button></div>
            <div className={'pv-gantt-bar ' + (row.point ? 'pv-gantt-bar--point ' : '') + (highlight && chain.includes(row.task.id) ? 'pv-gantt-bar--critical' : '')} style={{ left: LABEL + x(start), width: Math.max(18, (end - start + (row.point ? 0 : 1)) * px), background: STATUS_COLORS[row.task.status] }}
              onPointerMove={e => { if (drag?.task.id === row.task.id) { const days = Math.round((e.clientX - drag.origin) / px); if (days) moved.current = true; setDrag({ ...drag, days }); } }} onPointerUp={finish} onPointerCancel={() => setDrag(null)}>
              {!row.point && editable && <button className="pv-resize pv-resize--start" aria-label={'Resize start of ' + row.task.title} onPointerDown={e => begin(e, row.task, 'start')} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); void actions.run(async () => actions.saveDates(row.task, shiftedTaskDates(row.task, e.key === 'ArrowLeft' ? -1 : 1, 'start'))); } }}/>}
              <button className="pv-gantt-bar-title" aria-label={'Gantt task ' + row.task.title} title={`${row.task.title}: ${dayString(start)} → ${dayString(end)}`} onPointerDown={e => begin(e, row.task, 'move')} onClick={() => { if (!moved.current) onOpenTask(row.task.id); moved.current = false; }} onKeyDown={e => { if (editable && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); void actions.run(async () => actions.saveDates(row.task, shiftedTaskDates(row.task, e.key === 'ArrowLeft' ? -1 : 1, 'move'))); } }}>{row.point ? '◆' : row.task.title}</button>
              {!row.point && editable && <button className="pv-resize pv-resize--end" aria-label={'Resize end of ' + row.task.title} onPointerDown={e => begin(e, row.task, 'end')} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); void actions.run(async () => actions.saveDates(row.task, shiftedTaskDates(row.task, e.key === 'ArrowLeft' ? -1 : 1, 'end'))); } }}/>}
            </div>
          </div>;
        })}
        {milestones.map((milestone, index) => <div className="pv-gantt-row" key={milestone.id} style={{ top: HEADER + (rows.length + index) * ROW, width: width + LABEL }}><div className="pv-gantt-label" style={{ width: LABEL }}><button onClick={onOpenPlan}><Flag size={14}/>{milestone.title}</button></div><button className="pv-milestone" style={{ left: LABEL + x(milestone.day) }} onClick={onOpenPlan} title={milestone.title + ' · ' + dayString(milestone.day)}>◆</button></div>)}
      </div>
    </div>
    {!rows.length && !milestones.length && <p className="pv-empty">No dated work matches this view. Add dates to tasks below or in the Main Table.</p>}
    {unscheduled.length > 0 && <div className="pv-unscheduled"><strong>Unscheduled tasks</strong>{unscheduled.map(task => <div key={task.id}><button onClick={() => onOpenTask(task.id)}>{task.title}</button><button disabled={!actions.canEditDates(task)} onClick={() => setEditing(task)}>Set dates</button></div>)}</div>}
    {editing && <TaskDatesDialog key={editing.id} task={editing} onClose={() => setEditing(null)} onSave={actions.saveDates}/>}
  </section>;
}
