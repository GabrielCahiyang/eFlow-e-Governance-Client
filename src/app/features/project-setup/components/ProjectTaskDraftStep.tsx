import { readableUiError } from '../../../shared/userFacingError';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { BookmarkPlus, ClipboardList, RotateCcw, X } from 'lucide-react';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { ProjectImportSaveError, saveReviewedProject } from '../../project-import';
import {
  parseProjectTaskGroups,
  saveProjectTaskTemplate,
  type ProjectTaskGroup,
  type ProjectTaskTemplate,
} from '../../work-templates';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { projectSetupTaskPayload } from '../services/projectTaskDraft';
import { FlowError } from './FlowError';

interface UndoSnapshot {
  label: string;
  groups: ProjectTaskGroup[];
  omitted: Set<string>;
}

export interface SetupIncompleteNotice {
  missingLabels: string[];
  firstMissingStepIndex: number;
  firstMissingStepLabel: string;
  onGoToStep: (index: number) => void;
}

export function ProjectTaskDraftStep({
  projectId,
  project,
  templates,
  templateError,
  initialTemplate,
  setupIncompleteNotice,
  onEnsureReady,
  onTemplateSaved,
  onSaved,
  onBusyChange,
  formId,
  onSaveStateChange,
}: {
  projectId: string;
  project: {
    title: string;
    start?: string;
    end?: string;
  };
  templates: ProjectTaskTemplate[];
  templateError: string;
  initialTemplate?: ProjectTaskTemplate;
  setupIncompleteNotice?: SetupIncompleteNotice | null;
  onEnsureReady?: () => Promise<string>;
  onTemplateSaved?: (saved: ProjectTaskTemplate) => void;
  onSaved: (savedProjectId?: string) => void;
  onBusyChange: (busy: boolean) => void;
  formId?: string;
  onSaveStateChange?: (state: { label: string; disabled: boolean }) => void;
}) {
  const [groups, setGroups] = useState<ProjectTaskGroup[]>(initialTemplate?.groups ?? []);
  const [omitted, setOmitted] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState(initialTemplate?.id ?? '');
  const [hasEdits, setHasEdits] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<'saving' | 'saving-template'>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateNameTouched, setSaveTemplateNameTouched] = useState(false);
  const [savedTemplateNotice, setSavedTemplateNotice] = useState('');
  const request = useRef<{ id: string; payload: ReturnType<typeof projectSetupTaskPayload> } | undefined>(undefined);
  const pending = useRef(false);

  useEffect(() => {
    if (!hasEdits && initialTemplate && initialTemplate.id !== template) {
      try {
        setGroups(parseProjectTaskGroups(initialTemplate.groups));
        setOmitted(new Set());
        setTemplate(initialTemplate.id);
      } catch {
        // Keep existing groups if template cannot be parsed.
      }
    }
  }, [hasEdits, initialTemplate, template]);

  useNavigationBlocker({
    label: 'Draft tasks',
    identity: projectId || 'draft-tasks',
    dirty: groups.length > 0,
    pending: !!busy,
    pendingCheck: () => pending.current,
    onDiscard: () => {
      setGroups([]);
      request.current = undefined;
    },
  });

  function toggle(key: string) {
    setHasEdits(true);
    setOmitted((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function removeGroup(gIndex: number) {
    request.current = undefined;
    const removed = groups[gIndex];
    if (removed) {
      setUndoSnapshot({
        label: `Removed group “${removed.title || `Group ${gIndex + 1}`}”`,
        groups,
        omitted: new Set(omitted),
      });
    }
    setHasEdits(true);
    setGroups((current) => current.filter((_, index) => index !== gIndex));
    setOmitted((current) => {
      const next = new Set<string>();
      for (const entry of current) {
        const [rawG, ...rest] = entry.split('/');
        const g = Number(rawG);
        if (g === gIndex) continue;
        next.add(`${g > gIndex ? g - 1 : g}/${rest.join('/')}`);
      }
      return next;
    });
  }

  function removeTask(gIndex: number, tIndex: number) {
    request.current = undefined;
    const removed = groups[gIndex]?.tasks[tIndex];
    if (removed) {
      setUndoSnapshot({
        label: `Removed task “${removed.title || `Task ${tIndex + 1}`}”`,
        groups,
        omitted: new Set(omitted),
      });
    }
    setHasEdits(true);
    setGroups((current) =>
      current.map((item, index) =>
        index === gIndex ? { ...item, tasks: item.tasks.filter((_, taskIndex) => taskIndex !== tIndex) } : item,
      ),
    );
    setOmitted((current) => {
      const next = new Set<string>();
      for (const entry of current) {
        const parts = entry.split('/');
        const g = Number(parts[0]);
        const t = Number(parts[1]);
        if (g === gIndex && t === tIndex) continue;
        if (g === gIndex && t > tIndex) {
          next.add(`${g}/${t - 1}${parts.length > 2 ? `/${parts.slice(2).join('/')}` : ''}`);
        } else {
          next.add(entry);
        }
      }
      return next;
    });
  }

  function removeSubtask(gIndex: number, tIndex: number, sIndex: number) {
    request.current = undefined;
    const removed = groups[gIndex]?.tasks[tIndex]?.subtasks[sIndex];
    if (removed !== undefined) {
      setUndoSnapshot({
        label: `Removed subtask “${removed || `Subtask ${sIndex + 1}`}”`,
        groups,
        omitted: new Set(omitted),
      });
    }
    setHasEdits(true);
    setGroups((current) =>
      current.map((item, index) =>
        index === gIndex
          ? {
              ...item,
              tasks: item.tasks.map((row, taskIndex) =>
                taskIndex === tIndex
                  ? { ...row, subtasks: row.subtasks.filter((_, subIndex) => subIndex !== sIndex) }
                  : row,
              ),
            }
          : item,
      ),
    );
    setOmitted((current) => {
      const next = new Set<string>();
      for (const entry of current) {
        const parts = entry.split('/');
        const g = Number(parts[0]);
        const t = Number(parts[1]);
        const s = parts.length > 2 ? Number(parts[2]) : NaN;
        if (g === gIndex && t === tIndex && s === sIndex) continue;
        if (g === gIndex && t === tIndex && Number.isFinite(s) && s > sIndex) {
          next.add(`${g}/${t}/${s - 1}`);
        } else {
          next.add(entry);
        }
      }
      return next;
    });
  }

  function applyTemplate(value: string) {
    try {
      const chosen = templates.find((item) => item.id === value);
      setGroups(chosen ? parseProjectTaskGroups(chosen.groups) : []);
      setOmitted(new Set());
      setHasEdits(false);
      setUndoSnapshot(null);
      setValidationAttempted(false);
      setTouchedFields({});
      setError('');
      setTemplate(value);
      request.current = undefined;
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  const selected = groups
    .map((group, g) => ({
      ...group,
      tasks: group.tasks.flatMap((task, t) =>
        omitted.has(`${g}/${t}`)
          ? []
          : [
              {
                ...task,
                subtasks: task.subtasks.filter((_, s) => !omitted.has(`${g}/${t}/${s}`)),
              },
            ],
      ),
    }))
    .filter((group) => group.tasks.length);

  const taskCount = selected.reduce((count, group) => count + group.tasks.length, 0);
  const subtaskCount = selected.flatMap((group) => group.tasks).reduce((count, task) => count + task.subtasks.length, 0);

  const hasBlankSelectedTitle = selected.some(
    (group) =>
      !group.title.trim() ||
      group.tasks.some((task) => !task.title.trim() || task.subtasks.some((sub) => !sub.trim())),
  );

  const setupIncomplete = Boolean(setupIncompleteNotice);
  useEffect(() => {
    onSaveStateChange?.({
      label:
        busy === 'saving'
          ? 'Saving…'
          : retry
            ? 'Retry saving tasks'
            : taskCount
              ? 'Add tasks and open project'
              : 'Open project',
      disabled: !!busy || setupIncomplete,
    });
  }, [busy, retry, taskCount, setupIncomplete, onSaveStateChange]);

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(kind);
    onBusyChange(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(readableUiError(reason, 'Could not finish this action.', 'write'));
    } finally {
      pending.current = false;
      setBusy(undefined);
      onBusyChange(false);
    }
  }

  const finalizeWithoutTasks = () => {
    if (setupIncompleteNotice) {
      setError(`Complete ${setupIncompleteNotice.missingLabels.join(', ')} before creating the project.`);
      return;
    }
    if (projectId || !onEnsureReady) {
      onSaved(projectId || undefined);
      return;
    }
    void run('saving', async () => {
      const targetId = await onEnsureReady();
      onSaved(targetId);
    });
  };

  const save = () => {
    setValidationAttempted(true);
    if (setupIncompleteNotice) {
      setError(`Complete ${setupIncompleteNotice.missingLabels.join(', ')} before creating the project.`);
      return;
    }
    if (hasBlankSelectedTitle) {
      setError('Fill in all selected group, task, and subtask titles before saving.');
      return;
    }
    void run('saving', async () => {
      const targetId = projectId || (onEnsureReady ? await onEnsureReady() : '');
      if (!targetId) {
        throw new Error('Complete project details and funding before saving tasks.');
      }
      request.current ??= {
        id: crypto.randomUUID(),
        payload: projectSetupTaskPayload(selected, 'template', { startDate: project.start, targetDate: project.end }),
      };
      try {
        const result = await saveReviewedProject(
          'save_project_setup_tasks',
          targetId,
          request.current.id,
          request.current.payload,
        );
        if (!result?.taskIds || result.taskCount !== taskCount || result.subitemCount !== subtaskCount) {
          throw new Error('The save could not be confirmed. Retry to check the same batch.');
        }
      } catch (reason) {
        const uncertain = !(reason instanceof ProjectImportSaveError) || reason.retrySameBatch;
        if (!uncertain) request.current = undefined;
        setRetry(uncertain);
        throw reason;
      }
      request.current = undefined;
      onSaved(targetId);
    });
  };

  const saveTemplateNameError = textLengthError(saveTemplateName, 'Starter template name', {
    required: true,
    max: INPUT_LIMITS.GROUP_TITLE,
  });
  const visibleSaveTemplateNameError = saveTemplateNameTouched ? saveTemplateNameError : '';

  const saveAsTemplate = () => {
    setValidationAttempted(true);
    setSaveTemplateNameTouched(true);
    if (saveTemplateNameError) {
      setError(saveTemplateNameError);
      return;
    }
    if (hasBlankSelectedTitle) {
      setError('Fill in all selected group, task, and subtask titles before saving a template.');
      return;
    }
    void run('saving-template', async () => {
      const saved = await saveProjectTaskTemplate(saveTemplateName, selected);
      setTemplate(saved.id);
      setSaveTemplateOpen(false);
      setSaveTemplateNameTouched(false);
      setSavedTemplateNotice(`Saved “${saved.name}” to starter templates.`);
      onTemplateSaved?.(saved);
    });
  };

  return (
    <form
      id={formId}
      className="pf-task-draft"
      aria-label="Draft tasks"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !pending.current) {
          if (taskCount) save();
          else finalizeWithoutTasks();
        }
      }}
    >
      <div className="pf-task-draft-header">
        <p className="pf-eyebrow">DRAFT TASKS</p>
        <h2>Draft tasks</h2>
        <p>Use a shared template and choose which tasks and subtasks to add.</p>
      </div>
      {setupIncompleteNotice && (
        <div className="pf-draft-ahead-banner" role="status">
          <div>
            <strong>Finish earlier setup tabs before creating the project</strong>
            <p>
              Your drafted tasks stay saved here while you jump back to complete:{' '}
              {setupIncompleteNotice.missingLabels.join(', ')}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setupIncompleteNotice.onGoToStep(setupIncompleteNotice.firstMissingStepIndex)}
          >
            Go to {setupIncompleteNotice.firstMissingStepLabel}
          </button>
        </div>
      )}
      <div className="pf-task-draft-options pf-task-draft-toolbar">
        <label>
          <span>
            <ClipboardList size={16} /> Use a template
          </span>
          <select
            value={template}
            disabled={!templates.length || !!busy || retry}
            onChange={(event) => {
              const value = event.target.value;
              if (groups.length > 0 && hasEdits && value !== template) {
                setPendingTemplateId(value);
                return;
              }
              applyTemplate(value);
            }}
          >
            <option value="">
              {templates.length ? 'Choose a template' : 'No starter templates yet'}
            </option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <p className="pf-task-draft-toolbar-note">
          {templates.length
            ? `${templates.length} starter ${templates.length === 1 ? 'template' : 'templates'} available · Optional`
            : 'Optional — you can add tasks after opening the project'}
        </p>
      </div>
      {templateError && <p role="status">{templateError}</p>}
      <FlowError error={error} />
      {!groups.length && !templateError && (
        <div className="pf-task-draft-empty">
          <div className="pf-task-draft-empty-icon" aria-hidden="true">
            <ClipboardList size={22} />
          </div>
          <h3>{templates.length ? 'No template selected yet' : 'No starter templates available'}</h3>
          <p>
            {templates.length
              ? 'Choose a shared template above to preview and customize its task groups, or click Open project to start with an empty work plan.'
              : 'Click Open project to create the project and add your task groups directly in the workspace.'}
          </p>
        </div>
      )}
      {undoSnapshot && (
        <div className="pf-task-draft-undo" role="status">
          <span>{undoSnapshot.label}.</span>
          <button
            type="button"
            onClick={() => {
              setGroups(undoSnapshot.groups);
              setOmitted(undoSnapshot.omitted);
              setUndoSnapshot(null);
            }}
          >
            <RotateCcw size={13} />
            Undo
          </button>
        </div>
      )}
      {groups.map((group, g) => {
        const groupHasSelectedTasks = group.tasks.some((_, t) => !omitted.has(`${g}/${t}`));
        const groupFieldKey = `g-${g}`;
        const groupBlankError =
          (validationAttempted || touchedFields[groupFieldKey]) && groupHasSelectedTasks && !group.title.trim()
            ? 'Group name is required.'
            : undefined;
        return (
          <fieldset key={g} className="pf-task-draft-group" disabled={!!busy || retry}>
            <legend>{group.title || `Group ${g + 1}`}</legend>
            <div className="pf-task-draft-group-row">
              <BoundedTextInput
                aria-label={`Group ${g + 1} name`}
                value={group.title}
                maxLength={INPUT_LIMITS.GROUP_TITLE}
                error={groupBlankError}
                onBlur={() => setTouchedFields((prev) => ({ ...prev, [groupFieldKey]: true }))}
                onChange={(event) => {
                  setHasEdits(true);
                  setGroups((current) =>
                    current.map((item, index) => (index === g ? { ...item, title: event.target.value } : item)),
                  );
                }}
              />
              <WorkspaceTooltip content="Remove this group">
                <button
                  type="button"
                  className="pf-task-draft-remove"
                  aria-label={`Remove group ${group.title || g + 1}`}
                  onClick={() => removeGroup(g)}
                >
                  <X size={15} />
                </button>
              </WorkspaceTooltip>
            </div>
            {group.tasks.map((task, t) => {
              const key = `${g}/${t}`;
              const included = !omitted.has(key);
              const taskFieldKey = `t-${key}`;
              const taskBlankError =
                (validationAttempted || touchedFields[taskFieldKey]) && included && !task.title.trim()
                  ? 'Task name is required.'
                  : undefined;
              const editTask = (next: typeof task) => {
                setHasEdits(true);
                setGroups((current) =>
                  current.map((item, index) =>
                    index === g
                      ? { ...item, tasks: item.tasks.map((row, taskIndex) => (taskIndex === t ? next : row)) }
                      : item,
                  ),
                );
              };
              return (
                <div className="pf-task-draft-task" key={key}>
                  <div>
                    <input
                      type="checkbox"
                      aria-label={`Include ${task.title}`}
                      checked={included}
                      onChange={() => toggle(key)}
                    />
                    <BoundedTextInput
                      aria-label={`Task ${t + 1} name in group ${g + 1}`}
                      maxLength={INPUT_LIMITS.TASK_TITLE}
                      disabled={!included}
                      value={task.title}
                      error={taskBlankError}
                      onBlur={() => setTouchedFields((prev) => ({ ...prev, [taskFieldKey]: true }))}
                      onChange={(event) => editTask({ ...task, title: event.target.value })}
                    />
                    <WorkspaceTooltip content="Remove this task">
                      <button
                        type="button"
                        className="pf-task-draft-remove"
                        aria-label={`Remove task ${task.title || t + 1}`}
                        onClick={() => removeTask(g, t)}
                      >
                        <X size={14} />
                      </button>
                    </WorkspaceTooltip>
                  </div>
                  {task.subtasks.map((item, s) => {
                    const subIncluded = included && !omitted.has(`${key}/${s}`);
                    const subFieldKey = `s-${key}/${s}`;
                    const subBlankError =
                      (validationAttempted || touchedFields[subFieldKey]) && subIncluded && !item.trim()
                        ? 'Subtask name is required.'
                        : undefined;
                    return (
                      <div className="pf-task-draft-subtask" key={s}>
                        <input
                          type="checkbox"
                          aria-label={`Include ${item}`}
                          disabled={!included}
                          checked={subIncluded}
                          onChange={() => toggle(`${key}/${s}`)}
                        />
                        <BoundedTextInput
                          aria-label={`Subtask ${s + 1} for ${task.title}`}
                          maxLength={INPUT_LIMITS.TITLE}
                          disabled={!subIncluded}
                          value={item}
                          error={subBlankError}
                          onBlur={() => setTouchedFields((prev) => ({ ...prev, [subFieldKey]: true }))}
                          onChange={(event) =>
                            editTask({
                              ...task,
                              subtasks: task.subtasks.map((value, index) => (index === s ? event.target.value : value)),
                            })
                          }
                        />
                        <WorkspaceTooltip content="Remove this subtask">
                          <button
                            type="button"
                            className="pf-task-draft-remove"
                            aria-label={`Remove subtask ${item || s + 1}`}
                            onClick={() => removeSubtask(g, t, s)}
                          >
                            <X size={13} />
                          </button>
                        </WorkspaceTooltip>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </fieldset>
        );
      })}
      {!!groups.length && (
        <>
          {savedTemplateNotice && (
            <p className="pf-task-draft-save-note" role="status">
              {savedTemplateNotice}
            </p>
          )}
          {saveTemplateOpen && (() => {
            const saveStarterDisabled = !saveTemplateName.trim() || !taskCount || !!busy;
            const saveStarterTip = busy
              ? ''
              : !saveTemplateName.trim()
                ? 'Enter a starter template name before saving.'
                : !taskCount
                  ? 'Select at least one task to include in this template.'
                  : '';
            return (
              <div className="pf-task-draft-save-bar">
                <BoundedTextInput
                  aria-label="New starter template name"
                  aria-required="true"
                  maxLength={INPUT_LIMITS.GROUP_TITLE}
                  placeholder="Starter template name"
                  value={saveTemplateName}
                  disabled={!!busy}
                  error={visibleSaveTemplateNameError || undefined}
                  onBlur={() => setSaveTemplateNameTouched(true)}
                  onChange={(event) => {
                    setSaveTemplateName(event.target.value);
                    if (!saveTemplateNameTouched) setSaveTemplateNameTouched(true);
                  }}
                />
                <ActionBlockerGroup
                  actionLabel="Save starter template"
                  blockers={saveStarterDisabled ? saveStarterTip : []}
                  busy={Boolean(busy)}
                  size="sm"
                >
                  <Button
                    type="button"
                    kind="primary"
                    size="small"
                    disabled={saveStarterDisabled}
                    onClick={saveAsTemplate}
                  >
                    {busy === 'saving-template' ? 'Saving template…' : 'Save starter template'}
                  </Button>
                </ActionBlockerGroup>
                <Button
                  type="button"
                  kind="tertiary"
                  size="small"
                  disabled={!!busy}
                  onClick={() => {
                    setSaveTemplateOpen(false);
                    setSaveTemplateNameTouched(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            );
          })()}
          <footer className="pf-task-draft-options">
            <p>
              {taskCount} selected {taskCount === 1 ? 'task' : 'tasks'} · {subtaskCount}{' '}
              {subtaskCount === 1 ? 'subtask' : 'subtasks'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(() => {
                const saveAsTemplateDisabled = !taskCount || !!busy || retry;
                const saveAsTemplateTip = busy
                  ? ''
                  : retry
                    ? 'Finish retrying the pending task save before saving as a template.'
                    : !taskCount
                      ? 'Select at least one task before saving as a template.'
                      : '';
                const addTasksDisabled = !taskCount || !!busy;
                const addTasksTip = busy
                  ? ''
                  : !taskCount
                    ? 'Select at least one task to add to this project.'
                    : '';
                return (
                  <>
                    <ActionBlockerGroup
                      actionLabel="Save as template"
                      blockers={saveAsTemplateDisabled ? saveAsTemplateTip : []}
                      busy={Boolean(busy)}
                      size="sm"
                    >
                      <Button
                        type="button"
                        kind="secondary"
                        size="small"
                        disabled={saveAsTemplateDisabled}
                        onClick={() => {
                          setSavedTemplateNotice('');
                          setSaveTemplateNameTouched(false);
                          setSaveTemplateName((current) =>
                            current || `${project.title.trim() || 'Project'} starter`.slice(0, INPUT_LIMITS.GROUP_TITLE),
                          );
                          setSaveTemplateOpen(true);
                        }}
                      >
                        <BookmarkPlus size={15} style={{ marginRight: 5 }} />
                        Save as template
                      </Button>
                    </ActionBlockerGroup>
                    {!formId && (
                      <ActionBlockerGroup
                        actionLabel="Add tasks and open project"
                        blockers={addTasksDisabled ? addTasksTip : []}
                        busy={Boolean(busy)}
                        size="sm"
                      >
                        <button type="button" className="pf-primary" disabled={addTasksDisabled} onClick={save}>
                          {busy === 'saving' ? 'Saving…' : retry ? 'Retry saving tasks' : 'Add tasks and open project'}
                        </button>
                      </ActionBlockerGroup>
                    )}
                  </>
                );
              })()}
            </div>
          </footer>
        </>
      )}

      {pendingTemplateId !== null && (
        <DecisionModal
          title="Replace current draft tasks?"
          description="Switching templates will replace the edits and removals you made to the current task draft."
          decision="changes"
          confirmLabel="Replace draft tasks"
          requireReason={false}
          onCancel={() => setPendingTemplateId(null)}
          onConfirm={() => {
            const nextId = pendingTemplateId;
            setPendingTemplateId(null);
            applyTemplate(nextId);
          }}
        />
      )}
    </form>
  );
}
