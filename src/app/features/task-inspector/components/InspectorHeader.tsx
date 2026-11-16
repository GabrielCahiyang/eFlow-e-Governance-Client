import { useRef } from 'react';
import { X } from 'lucide-react';
import type { Task } from '../../tasks';
import { PriorityPill, TaskStatusBadge } from '../../../components/workflow/StatusBadges';
import { WorkspaceTooltip } from '../../../components/ui/workspace';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { TaskInspectorSection } from '../types';

export function InspectorHeader({ task, tab, tabs, onTab, onClose, busy, actions }: {
  task: Task; tab: TaskInspectorSection; tabs: ReadonlyArray<{ id: TaskInspectorSection; label: string }>;
  onTab: (id: TaskInspectorSection) => void; onClose: () => void; busy: boolean; actions?: React.ReactNode;
}) {
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <header className="task-drawer__header">
      <div className="task-drawer__top">
        <div className="task-drawer__title-group">
          <div className="task-drawer__meta-pills">
            <span className="task-page__record-pill">Task</span>
            <TaskStatusBadge status={task.status} customStatusId={task.customStatusId} />
            <PriorityPill priority={task.priority} />
          </div>
          <h2 className="task-drawer__title">{task.title}</h2>
        </div>
        <WorkspaceTooltip content="Close task details">
          <button
            type="button"
            className="task-drawer__close"
            aria-label="Close task detail"
            disabled={busy}
            onClick={() => { void requestNavigation(onClose); }}
          >
            <X size={18} />
          </button>
        </WorkspaceTooltip>
      </div>
      {actions && <div className="flex gap-2 flex-wrap mt-2">{actions}</div>}
      <div role="tablist" aria-label="Task sections" className="task-drawer__tabs">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            ref={node => { controls.current[index] = node; }}
            id={`task-${task.id}-${item.id}`}
            aria-controls={`task-panel-${task.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'task-drawer__tab is-active' : 'task-drawer__tab'}
            onClick={() => { void requestNavigation(() => onTab(item.id)); }}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              void requestNavigation(() => { onTab(tabs[next].id); controls.current[next]?.focus(); });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
