import { useRef } from 'react';
import { Button, Heading, Tab } from '@vibe/core';
import {
  ArrowLeft,
  FileText,
  FolderKanban,
  FolderOpen,
  Layers,
  LockKeyhole,
  MessageSquareText,
  X,
} from 'lucide-react';
import type { Task } from '../../tasks';
import { TaskStatusBadge, PriorityPill } from '../../../components/workflow/StatusBadges';
import { DeadlineBadge } from '../../../components/ui/DeadlineBadge';
import { WorkspaceTooltip } from '../../../components/ui/workspace';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { TaskInspectorSection } from '../types';

const SECTION_ICONS: Record<TaskInspectorSection, typeof FileText> = {
  overview: FileText,
  work: Layers,
  updates: MessageSquareText,
  files: FolderOpen,
};

export function TaskPageHeader({
  task,
  projectTitle,
  tab,
  tabs,
  onTab,
  onClose,
  busy,
  readOnly = false,
  dialog = false,
  backLabel = 'Back to My Work',
}: {
  task: Task;
  projectTitle?: string;
  tab: TaskInspectorSection;
  tabs: ReadonlyArray<{ id: TaskInspectorSection; label: string }>;
  onTab: (tab: TaskInspectorSection) => void;
  onClose: () => void;
  busy: boolean;
  readOnly?: boolean;
  dialog?: boolean;
  backLabel?: string;
}) {
  const tabList = useRef<HTMLUListElement>(null);
  const controls = () => Array.from(tabList.current?.querySelectorAll<HTMLElement>('[role=tab]') || []);
  const select = (index: number, focus = false) =>
    void requestNavigation(() => {
      onTab(tabs[index].id);
      if (focus) controls()[index]?.focus();
    });

  return (
    <header className={dialog ? 'task-page__header task-page__header--dialog' : 'task-page__header'}>
      <div className="task-page__topbar">
        <div className="task-page__eyebrow">
          {!dialog && (
            <WorkspaceTooltip content="Return to previous view">
              <Button kind="tertiary" size="small" disabled={busy} onClick={() => void requestNavigation(onClose)}>
                <ArrowLeft size={16} aria-hidden="true" />
                {backLabel}
              </Button>
            </WorkspaceTooltip>
          )}
          {projectTitle && (
            <span className="task-page__project-chip">
              <FolderKanban size={14} aria-hidden="true" />
              <span>{projectTitle}</span>
            </span>
          )}
          {readOnly && (
            <WorkspaceTooltip content="Operational changes remain with the assigned team">
              <span className="task-page__lock-chip">
                <LockKeyhole size={12} aria-hidden="true" />
                <span>Read-only oversight</span>
              </span>
            </WorkspaceTooltip>
          )}
        </div>
        {dialog && (
          <WorkspaceTooltip content="Close task details">
            <button
              type="button"
              className="task-drawer__close"
              aria-label="Close task detail"
              disabled={busy}
              onClick={() => void requestNavigation(onClose)}
            >
              <X size={18} />
            </button>
          </WorkspaceTooltip>
        )}
      </div>

      <div className="task-page__heading">
        <div className="task-page__title">
          <Heading type="h1">{task.title}</Heading>
        </div>
        <div className="task-page__badges">
          <TaskStatusBadge status={task.status} customStatusId={task.customStatusId} />
          <PriorityPill priority={task.priority} />
          <DeadlineBadge value={task.deadline || task.dueDate} status={task.status} />
        </div>
      </div>

      <div className="task-page__tabs">
        <ul
          ref={tabList}
          role="tablist"
          aria-label="Task sections"
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = controls().findIndex(control => control === document.activeElement);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (Math.max(0, index) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            select(next, true);
          }}
        >
          {tabs.map((item, index) => {
            const Icon = SECTION_ICONS[item.id];
            return (
              <Tab
                key={item.id}
                id={`task-${task.id}-${item.id}`}
                aria-controls={`task-panel-${task.id}`}
                active={tab === item.id}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => select(index)}
              >
                <span className="task-page__tab-label">
                  <Icon size={15} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              </Tab>
            );
          })}
        </ul>
      </div>
    </header>
  );
}
