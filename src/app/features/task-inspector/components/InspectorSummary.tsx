import type { ReactNode } from 'react';
import { ArrowRight, Building2, Calendar, CalendarDays, Layers, ListChecks } from 'lucide-react';
import { TaskDepartmentLabel, type Task } from '../../tasks';
import { formatDate } from '../../../components/workflow/primitives';
import { WorkBudgetCard } from '../../budget';
import { supportsNestedWork } from '../../nested-work';
import './taskOverview.css';

export function InspectorSummary({
  task,
  readOnly,
  dependencies,
  canManageSubtasks,
  canAuthorizeFunding = false,
  authorityPending = false,
  fundingTask,
  budgetReadOnly,
  subtaskSummary,
  onOpenWork,
  teamSlot,
}: {
  task: Task;
  projectTitle?: string;
  readOnly: boolean;
  dependencies: Task[];
  canManageSubtasks: boolean;
  overdue: boolean;
  rejected?: boolean;
  canAuthorizeFunding?: boolean;
  authorityPending?: boolean;
  fundingTask?: Task;
  budgetReadOnly?: boolean;
  subtaskSummary?: { total: number; completed: number };
  onOpenWork?: () => void;
  teamSlot?: ReactNode;
}) {
  const unresolvedDependencies = dependencies.filter(t => t.status !== 'completed');
  const scheduleText =
    task.startDate && (task.deadline || task.dueDate)
      ? `${formatDate(task.startDate)} → ${formatDate((task.deadline || task.dueDate)!)}`
      : task.deadline || task.dueDate
        ? `Due ${formatDate((task.deadline || task.dueDate)!)}`
        : task.startDate
          ? `Starts ${formatDate(task.startDate)}`
          : 'No dates set';

  const trimmedDescription = task.description?.trim() || '';
  const hasSecondaryBlocks =
    task.status === 'cancelled' ||
    Boolean(task.acceptanceCriteria?.length) ||
    Boolean(task.definitionOfDone) ||
    dependencies.length > 0 ||
    (task.dependencyIds?.length || 0) > dependencies.length;
  const showDescriptionTile = Boolean(trimmedDescription || hasSecondaryBlocks);

  const compactTopCount = 1 + (subtaskSummary ? 1 : 0) + (teamSlot ? 1 : 0);
  const compactTileSpanClass =
    compactTopCount === 3
      ? 'task-overview__tile--third'
      : compactTopCount === 2
        ? 'task-overview__tile--half'
        : 'task-overview__tile--full';

  return (
    <section aria-label="Task overview" className="task-overview">
      <div className="task-overview__bento">
        {showDescriptionTile && (
          <section
            className="task-overview__tile task-overview__tile--description task-overview__description"
            aria-label="Task description"
          >
            {trimmedDescription && (
              <>
                <h3>Description</h3>
                <p>{task.description}</p>
              </>
            )}

            {hasSecondaryBlocks && (
              <div className={trimmedDescription ? 'task-overview__subblocks' : 'task-overview__subblocks is-standalone'}>
                {task.status === 'cancelled' && (
                  <div className="task-overview__subblock">
                    <div className="task-overview__block-label">Cancellation reason</div>
                    <div className="task-overview__block-text">
                      {task.cancellationReason || 'No cancellation reason recorded.'}
                    </div>
                  </div>
                )}

                {(Boolean(task.acceptanceCriteria?.length) || task.definitionOfDone) && (
                  <div className="task-overview__subblock">
                    <div className="task-overview__block-label">Completion standard</div>
                    {task.acceptanceCriteria?.length ? (
                      <ul className="task-overview__list">
                        {task.acceptanceCriteria.map(criterion => <li key={criterion}>{criterion}</li>)}
                      </ul>
                    ) : null}
                    {task.definitionOfDone && (
                      <div className="task-overview__done">Done when: {task.definitionOfDone}</div>
                    )}
                  </div>
                )}

                {dependencies.length > 0 && (
                  <div className={unresolvedDependencies.length ? 'task-overview__deps is-waiting' : 'task-overview__deps is-clear'}>
                    <div className="task-overview__block-label">
                      Dependencies · {dependencies.length - unresolvedDependencies.length}/{dependencies.length} complete
                    </div>
                    <div className="task-overview__deps-list">
                      {dependencies.map(dependency => (
                        <div key={dependency.id}>{dependency.status === 'completed' ? '✓' : '○'} {dependency.title}</div>
                      ))}
                    </div>
                  </div>
                )}

                {(task.dependencyIds?.length || 0) > dependencies.length && (
                  <p role="status" className="task-overview__warning">
                    Some dependencies are unavailable. Their completion cannot be verified here.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <aside
          className={`task-overview__tile task-overview__rail-card ${
            showDescriptionTile ? 'task-overview__tile--details' : compactTileSpanClass
          }`}
          aria-label="Task metadata"
        >
          <h3>Details</h3>
          <div className={showDescriptionTile || compactTopCount === 1 ? 'task-overview__rail-fields' : 'task-overview__rail-fields is-stacked'}>
            <InspectorField
              icon={<Building2 size={14} aria-hidden="true" />}
              label="Responsible office"
              value={<TaskDepartmentLabel task={task} />}
            />
            <InspectorField
              icon={<CalendarDays size={14} aria-hidden="true" />}
              label="Schedule"
              value={scheduleText}
            />
            {task.programTitle && (
              <InspectorField
                icon={<Layers size={14} aria-hidden="true" />}
                label="Program"
                value={task.programTitle}
              />
            )}
            {!task.startDate && !task.deadline && !task.dueDate && (
              <InspectorField
                icon={<Calendar size={14} aria-hidden="true" />}
                label="Dates"
                value="Unscheduled"
              />
            )}
          </div>
        </aside>

        {teamSlot && (
          <div
            className={`task-overview__tile task-overview__rail-card ${
              showDescriptionTile
                ? subtaskSummary
                  ? 'task-overview__tile--team'
                  : 'task-overview__tile--full'
                : compactTileSpanClass
            }`}
          >
            <h3>Task team</h3>
            {teamSlot}
          </div>
        )}

        {subtaskSummary && (
          <div
            className={`task-overview__tile task-overview__work-link ${
              showDescriptionTile
                ? teamSlot
                  ? 'task-overview__tile--work'
                  : 'task-overview__tile--full'
                : compactTileSpanClass
            }`}
          >
            <div className="task-overview__work-link-copy">
              <span className="inspector-field__icon" aria-hidden="true">
                <ListChecks size={15} />
              </span>
              <div>
                <strong>
                  {subtaskSummary.total > 0
                    ? `${subtaskSummary.completed} of ${subtaskSummary.total} subtask${subtaskSummary.total === 1 ? '' : 's'} complete`
                    : 'No subtasks added yet'}
                </strong>
                <span>View steps, post progress updates, or submit work</span>
              </div>
            </div>
            {onOpenWork && (
              <button type="button" className="task-overview__jump" onClick={onOpenWork}>
                <span>Open Work</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="task-overview__tile--full">
          <WorkBudgetCard
            task={fundingTask || task}
            canManage={canManageSubtasks}
            canAuthorizeFunding={canAuthorizeFunding}
            readOnly={supportsNestedWork(task) ? (budgetReadOnly ?? readOnly) : false}
            authorityPending={authorityPending}
          />
        </div>
      </div>
    </section>
  );
}

export function InspectorField({
  icon,
  label,
  value,
  hint,
  hintTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  hintTone?: 'bad';
}) {
  return (
    <div className="inspector-field">
      <div className="inspector-field__label">
        <span className="inspector-field__icon" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="inspector-field__value">{value}</div>
      {hint && (
        <div className={hintTone === 'bad' ? 'inspector-field__hint is-bad' : 'inspector-field__hint'}>
          {hint}
        </div>
      )}
    </div>
  );
}
