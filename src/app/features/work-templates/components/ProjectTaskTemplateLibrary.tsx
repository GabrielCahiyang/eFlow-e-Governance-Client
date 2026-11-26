import { readableUiError } from '../../../shared/userFacingError';
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { BoundedTextInput } from "../../../components/ui/BoundedInput";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
import { duplicateWorkNameError } from "../../../shared/workNames";
import { Button } from '@vibe/core';
import { Copy, Edit3, Layers, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import {
  listProjectTaskTemplates,
  retireProjectTaskTemplate,
  saveProjectTaskTemplate,
  summarizeProjectTaskTemplate,
  type ProjectTaskTemplate,
} from '../projectTaskTemplates';
import './workTemplates.css';

const MAX_GROUPS = 30;
const MAX_TOTAL_TASKS = 100;
const MAX_SUBTASKS_PER_TASK = 30;

interface ProjectTaskTemplateLibraryProps {
  onTemplatesChanged?: (saved?: ProjectTaskTemplate) => void;
  initialCreate?: boolean;
  compactHeader?: boolean;
}

function createEmptyDraft(): ProjectTaskTemplate {
  return {
    id: '',
    name: '',
    groups: [{ title: '', tasks: [{ title: '', subtasks: [] }] }],
  };
}

function buildDuplicateDraft(source: ProjectTaskTemplate): ProjectTaskTemplate {
  return {
    id: '',
    name: `${source.name} (copy)`.slice(0, INPUT_LIMITS.GROUP_TITLE),
    groups: source.groups.map(group => ({
      title: group.title,
      tasks: group.tasks.map(task => ({
        title: task.title,
        subtasks: task.subtasks.map(item => item.slice(0, INPUT_LIMITS.TITLE)),
      })),
    })),
  };
}

function firstTemplateValidationError(draft: ProjectTaskTemplate): string {
  const nameErr = textLengthError(draft.name, 'Template name', { required: true, max: INPUT_LIMITS.GROUP_TITLE });
  if (nameErr) return nameErr;
  if (!draft.groups.length || draft.groups.length > MAX_GROUPS) {
    return `Add between 1 and ${MAX_GROUPS} task groups.`;
  }
  const totalTasks = draft.groups.reduce((sum, group) => sum + group.tasks.length, 0);
  if (totalTasks > MAX_TOTAL_TASKS) {
    return `Templates can contain at most ${MAX_TOTAL_TASKS} tasks total.`;
  }
  for (let gIdx = 0; gIdx < draft.groups.length; gIdx++) {
    const group = draft.groups[gIdx];
    const groupErr =
      textLengthError(group.title, `Group ${gIdx + 1} name`, { required: true, max: INPUT_LIMITS.GROUP_TITLE }) ||
      (group.title.trim()
        ? duplicateWorkNameError(group.title, draft.groups.filter((_, idx) => idx !== gIdx), 'Group') || ''
        : '');
    if (groupErr) return groupErr;
    if (!group.tasks.length) return `Group ${gIdx + 1} needs at least one task.`;
    for (let tIdx = 0; tIdx < group.tasks.length; tIdx++) {
      const task = group.tasks[tIdx];
      const taskErr =
        textLengthError(task.title, `Task ${tIdx + 1}`, { required: true, max: INPUT_LIMITS.TASK_TITLE }) ||
        (task.title.trim()
          ? duplicateWorkNameError(task.title, group.tasks.filter((_, idx) => idx !== tIdx), 'Task') || ''
          : '');
      if (taskErr) return taskErr;
      if (task.subtasks.length > MAX_SUBTASKS_PER_TASK) {
        return `Use up to ${MAX_SUBTASKS_PER_TASK} subtasks per task.`;
      }
      const nonEmptySubtasks = task.subtasks.map((title, idx) => ({ title: title.trim(), idx })).filter(s => Boolean(s.title));
      for (const sub of nonEmptySubtasks) {
        const subErr =
          textLengthError(sub.title, `Subtask ${sub.idx + 1}`, { max: INPUT_LIMITS.TITLE }) ||
          duplicateWorkNameError(
            sub.title,
            nonEmptySubtasks.filter(other => other.idx !== sub.idx),
            'Subtask',
          ) ||
          '';
        if (subErr) return subErr;
      }
    }
  }
  return '';
}

export function ProjectTaskTemplateLibrary({
  onTemplatesChanged,
  initialCreate = false,
  compactHeader = false,
}: ProjectTaskTemplateLibraryProps = {}) {
  const formId = useId();
  const confirmation = useConfirmation();
  const [templates, setTemplates] = useState<ProjectTaskTemplate[]>([]);
  const [editor, setEditorState] = useState<ProjectTaskTemplate | undefined>(() =>
    initialCreate ? createEmptyDraft() : undefined,
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const openEditor = (next: ProjectTaskTemplate | undefined) => {
    setEditorState(next);
    setTouched({});
    setSubmitted(false);
    setError('');
  };

  const markTouched = (key: string) => {
    setTouched(prev => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const loadTemplates = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const rows = await listProjectTaskTemplates();
      setTemplates(rows);
    } catch (reason) {
      setError(readableUiError(reason, "Templates could not load.", 'read'));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  async function runSave(draft: ProjectTaskTemplate) {
    setSubmitted(true);
    const issue = firstTemplateValidationError(draft);
    if (issue) return;
    setBusy(true);
    setError('');
    try {
      const normalizedGroups = draft.groups.map(group => ({
        ...group,
        tasks: group.tasks.map(task => ({
          ...task,
          subtasks: task.subtasks.map(item => item.trim()).filter(Boolean),
        })),
      }));
      const saved = await saveProjectTaskTemplate(draft.name, normalizedGroups, draft.id || undefined);
      openEditor(undefined);
      const rows = await listProjectTaskTemplates();
      setTemplates(rows);
      onTemplatesChanged?.(saved);
    } catch (reason) {
      setError(readableUiError(reason, "Could not update the template library.", 'write'));
    } finally {
      setBusy(false);
    }
  }

  async function runRetire(template: ProjectTaskTemplate) {
    const confirmed = await confirmation.confirm({
      title: 'Delete this template?',
      description: `“${template.name}” will be removed from the shared library. Tasks already added to projects stay in those projects.`,
      actionLabel: 'Delete template',
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      await retireProjectTaskTemplate(template.id);
      const rows = await listProjectTaskTemplates();
      setTemplates(rows);
      onTemplatesChanged?.();
    } catch (reason) {
      setError(readableUiError(reason, "Could not delete this template.", 'write'));
    } finally {
      setBusy(false);
    }
  }

  const totalGroups = editor?.groups.length ?? 0;
  const totalTasks = editor ? editor.groups.reduce((sum, group) => sum + group.tasks.length, 0) : 0;
  const editorValidationError = editor ? firstTemplateValidationError(editor) : '';
  const templateNameError = editor
    ? textLengthError(editor.name, 'Template name', { required: true, max: INPUT_LIMITS.GROUP_TITLE })
    : '';
  const visibleTemplateNameError = touched['template-name'] || submitted ? templateNameError : '';

  const addGroupBlockers = [
    totalGroups >= MAX_GROUPS ? `Maximum of ${MAX_GROUPS} groups per template reached.` : '',
    totalTasks >= MAX_TOTAL_TASKS ? `Maximum of ${MAX_TOTAL_TASKS} total tasks per template reached.` : '',
  ].filter(Boolean);

  return (
    <section className="eflow-tpl-library" aria-label="Project starter templates">
      {confirmation.dialog}
      <header className="eflow-tpl-library-header">
        <div className="eflow-tpl-library-heading">
          {!compactHeader && <h3>Project starter templates</h3>}
          <p>
            Shared checklists ready to preload into new projects during setup and team review.
          </p>
        </div>
        {!editor && (
          <Button
            type="button"
            kind="primary"
            size="small"
            disabled={busy}
            onClick={() => openEditor(createEmptyDraft())}
          >
            New template
          </Button>
        )}
      </header>

      {error && (
        <FeedbackState tone="error" title="Template library issue" onRetry={() => void loadTemplates()} pending={busy}>
          {error}
        </FeedbackState>
      )}

      {editor ? (
        <form
          noValidate
          className="eflow-tpl-editor"
          onSubmit={event => {
            event.preventDefault();
            if (!busy) void runSave(editor);
          }}
        >
          <div className="eflow-tpl-group-head">
            <span className="eflow-tpl-group-badge">
              {editor.id ? 'Editing template' : 'New starter template'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="eflow-tpl-tag">
                {totalGroups} / {MAX_GROUPS} group{totalGroups === 1 ? '' : 's'}
              </span>
              <span className="eflow-tpl-tag">
                {totalTasks} / {MAX_TOTAL_TASKS} task{totalTasks === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="eflow-tpl-field">
            <label htmlFor={`${formId}-name`}>
              Template name <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <BoundedTextInput
              id={`${formId}-name`}
              className="eflow-tpl-input"
              aria-required="true"
              maxLength={INPUT_LIMITS.GROUP_TITLE}
              placeholder="e.g. Community Outreach Drive"
              value={editor.name}
              error={visibleTemplateNameError || undefined}
              disabled={busy}
              onBlur={() => markTouched('template-name')}
              onChange={event => setEditorState({ ...editor, name: event.target.value })}
            />
          </div>

          {editor.groups.map((group, groupIndex) => {
            const groupKey = `group-${groupIndex}`;
            const groupFieldId = `${formId}-${groupKey}`;
            const duplicateGroup = group.title.trim()
              ? duplicateWorkNameError(group.title, editor.groups.filter((_, idx) => idx !== groupIndex), 'Group') || ''
              : '';
            const groupError =
              textLengthError(group.title, 'Group name', { required: true, max: INPUT_LIMITS.GROUP_TITLE }) ||
              duplicateGroup;
            const visibleGroupError = touched[groupKey] || submitted || Boolean(duplicateGroup) ? groupError : '';
            const addTaskBlocker =
              totalTasks >= MAX_TOTAL_TASKS
                ? `Maximum of ${MAX_TOTAL_TASKS} total tasks per template reached.`
                : '';

            const editGroup = (next: typeof group) =>
              setEditorState({
                ...editor,
                groups: editor.groups.map((item, index) => (index === groupIndex ? next : item)),
              });

            return (
              <fieldset className="eflow-tpl-group-box" key={groupIndex} disabled={busy}>
                <div className="eflow-tpl-group-head">
                  <span className="eflow-tpl-group-badge">Group {groupIndex + 1}</span>
                  {editor.groups.length > 1 && (
                    <WorkspaceTooltip content="Removes this group and all tasks inside it from the template.">
                      <button
                        type="button"
                        className="eflow-tpl-link-btn eflow-tpl-link-btn--danger"
                        onClick={() =>
                          setEditorState({
                            ...editor,
                            groups: editor.groups.filter((_, index) => index !== groupIndex),
                          })
                        }
                      >
                        <Trash2 size={13} />
                        Remove group
                      </button>
                    </WorkspaceTooltip>
                  )}
                </div>

                <div className="eflow-tpl-field">
                  <label htmlFor={groupFieldId}>
                    Group name <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
                  </label>
                  <BoundedTextInput
                    id={groupFieldId}
                    className="eflow-tpl-input"
                    aria-required="true"
                    maxLength={INPUT_LIMITS.GROUP_TITLE}
                    placeholder="e.g. Planning & Approvals"
                    value={group.title}
                    error={visibleGroupError || undefined}
                    onBlur={() => markTouched(groupKey)}
                    onChange={event => editGroup({ ...group, title: event.target.value })}
                  />
                </div>

                {group.tasks.map((task, taskIndex) => {
                  const taskKey = `task-${groupIndex}-${taskIndex}`;
                  const taskFieldId = `${formId}-${taskKey}`;
                  const duplicateTask = task.title.trim()
                    ? duplicateWorkNameError(task.title, group.tasks.filter((_, idx) => idx !== taskIndex), 'Task') || ''
                    : '';
                  const taskError =
                    textLengthError(task.title, `Task ${taskIndex + 1}`, { required: true, max: INPUT_LIMITS.TASK_TITLE }) ||
                    duplicateTask;
                  const visibleTaskError = touched[taskKey] || submitted || Boolean(duplicateTask) ? taskError : '';
                  const addSubtaskBlocker =
                    task.subtasks.length >= MAX_SUBTASKS_PER_TASK
                      ? `Maximum of ${MAX_SUBTASKS_PER_TASK} subtasks per task reached.`
                      : '';

                  const editTask = (next: typeof task) =>
                    editGroup({
                      ...group,
                      tasks: group.tasks.map((item, index) => (index === taskIndex ? next : item)),
                    });

                  return (
                    <div key={taskIndex} className="eflow-tpl-task-card">
                      <div className="eflow-tpl-field">
                        <label htmlFor={taskFieldId}>
                          Task {taskIndex + 1} <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
                        </label>
                        <BoundedTextInput
                          id={taskFieldId}
                          className="eflow-tpl-input"
                          aria-required="true"
                          maxLength={INPUT_LIMITS.TASK_TITLE}
                          placeholder="e.g. Finalize partner MOU"
                          value={task.title}
                          error={visibleTaskError || undefined}
                          onBlur={() => markTouched(taskKey)}
                          onChange={event => editTask({ ...task, title: event.target.value })}
                        />
                      </div>

                      <div className="eflow-tpl-subtasks">
                        {task.subtasks.map((subtask, subIndex) => {
                          const subKey = `sub-${groupIndex}-${taskIndex}-${subIndex}`;
                          const duplicateSubtask = subtask.trim()
                            ? duplicateWorkNameError(
                                subtask,
                                task.subtasks
                                  .map((title, idx) => ({ title: title.trim(), idx }))
                                  .filter(other => other.idx !== subIndex && Boolean(other.title)),
                                'Subtask',
                              ) || ''
                            : '';
                          const subError =
                            textLengthError(subtask, `Subtask ${subIndex + 1}`, { max: INPUT_LIMITS.TITLE }) ||
                            duplicateSubtask;
                          const visibleSubError = touched[subKey] || submitted || Boolean(duplicateSubtask) ? subError : '';
                          return (
                            <div key={subIndex} className="eflow-tpl-subtask-row items-start">
                              <div className="min-w-0 flex-1">
                                <BoundedTextInput
                                  className="eflow-tpl-input"
                                  maxLength={INPUT_LIMITS.TITLE}
                                  aria-label={`Subtask ${subIndex + 1} for ${task.title || `Task ${taskIndex + 1}`}`}
                                  placeholder={`Subtask ${subIndex + 1}`}
                                  value={subtask}
                                  error={visibleSubError || undefined}
                                  onBlur={() => markTouched(subKey)}
                                  onChange={event =>
                                    editTask({
                                      ...task,
                                      subtasks: task.subtasks.map((s, idx) => (idx === subIndex ? event.target.value : s)),
                                    })
                                  }
                                />
                              </div>
                              <WorkspaceTooltip content={`Remove subtask ${subIndex + 1}`}>
                                <button
                                  type="button"
                                  className="eflow-tpl-link-btn eflow-tpl-link-btn--danger mt-1.5"
                                  aria-label={`Remove subtask ${subIndex + 1}`}
                                  onClick={() =>
                                    editTask({
                                      ...task,
                                      subtasks: task.subtasks.filter((_, idx) => idx !== subIndex),
                                    })
                                  }
                                >
                                  <Trash2 size={13} />
                                </button>
                              </WorkspaceTooltip>
                            </div>
                          );
                        })}
                        <div className="eflow-tpl-row-actions">
                          <ActionBlockerGroup
                            actionLabel="Add subtask"
                            blockers={addSubtaskBlocker}
                            busy={busy}
                            compact
                            size="sm"
                          >
                            <button
                              type="button"
                              className="eflow-tpl-link-btn"
                              disabled={busy || Boolean(addSubtaskBlocker)}
                              onClick={() => editTask({ ...task, subtasks: [...task.subtasks, ''] })}
                            >
                              <Plus size={13} />
                              Add subtask
                            </button>
                          </ActionBlockerGroup>
                          {group.tasks.length > 1 && (
                            <WorkspaceTooltip content="Removes this task and its subtasks from the group.">
                              <button
                                type="button"
                                className="eflow-tpl-link-btn eflow-tpl-link-btn--danger"
                                onClick={() =>
                                  editGroup({
                                    ...group,
                                    tasks: group.tasks.filter((_, index) => index !== taskIndex),
                                  })
                                }
                              >
                                <Trash2 size={13} />
                                Remove task
                              </button>
                            </WorkspaceTooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div>
                  <ActionBlockerGroup
                    actionLabel="Add task to group"
                    blockers={addTaskBlocker}
                    busy={busy}
                    compact
                    size="sm"
                  >
                    <button
                      type="button"
                      className="eflow-tpl-link-btn"
                      disabled={busy || Boolean(addTaskBlocker)}
                      onClick={() => editGroup({ ...group, tasks: [...group.tasks, { title: '', subtasks: [] }] })}
                    >
                      <Plus size={13} />
                      Add task to group
                    </button>
                  </ActionBlockerGroup>
                </div>
              </fieldset>
            );
          })}

          <div className="eflow-tpl-row-actions">
            <ActionBlockerGroup
              actionLabel="Add group"
              blockers={addGroupBlockers}
              busy={busy}
              size="sm"
            >
              <Button
                type="button"
                kind="secondary"
                size="small"
                disabled={busy || addGroupBlockers.length > 0}
                onClick={() =>
                  setEditorState({
                    ...editor,
                    groups: [...editor.groups, { title: '', tasks: [{ title: '', subtasks: [] }] }],
                  })
                }
              >
                Add group
              </Button>
            </ActionBlockerGroup>
            <div className="eflow-tpl-card-actions">
              <Button type="button" kind="tertiary" size="small" disabled={busy} onClick={() => openEditor(undefined)}>
                Cancel
              </Button>
              <ActionBlockerGroup
                actionLabel="Save template"
                blockers={editorValidationError}
                busy={busy}
                size="sm"
              >
                <Button type="submit" kind="primary" size="small" disabled={busy || Boolean(editorValidationError)}>
                  Save template
                </Button>
              </ActionBlockerGroup>
            </div>
          </div>
        </form>
      ) : (
        <>
          {busy && !templates.length && <p role="status">Loading starter templates…</p>}
          {!busy && !templates.length && !error && (
            <EmptyState
              illustration="projects"
              size="panel"
              title="No starter templates yet"
              description="Create a shared starter template with pre-structured groups, tasks, and subtasks so Project Setup can preload them in one click."
              action={
                <Button type="button" kind="primary" size="small" onClick={() => openEditor(createEmptyDraft())}>
                  Create first template
                </Button>
              }
            />
          )}
          {templates.map(template => {
            const summary = summarizeProjectTaskTemplate(template.groups);
            const groupPreview = template.groups.map(group => group.title).filter(Boolean).join(' · ');
            return (
              <article key={template.id} className="eflow-tpl-card">
                <div className="eflow-tpl-card-main">
                  <h4 className="eflow-tpl-card-title">{template.name}</h4>
                  <div className="eflow-tpl-meta-row">
                    <span className="eflow-tpl-tag eflow-tpl-tag--accent">
                      <Layers size={12} />
                      {summary.groupCount} group{summary.groupCount === 1 ? '' : 's'}
                    </span>
                    <span className="eflow-tpl-tag">
                      {summary.taskCount} task{summary.taskCount === 1 ? '' : 's'}
                    </span>
                    {summary.subtaskCount > 0 && (
                      <span className="eflow-tpl-tag">
                        {summary.subtaskCount} subtask{summary.subtaskCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {groupPreview && <p className="eflow-tpl-groups-line">{groupPreview}</p>}
                </div>
                <div className="eflow-tpl-card-actions">
                  <Button
                    type="button"
                    kind="secondary"
                    size="small"
                    disabled={busy}
                    onClick={() => openEditor(template)}
                  >
                    <Edit3 size={13} style={{ marginRight: 5 }} />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    kind="secondary"
                    size="small"
                    disabled={busy}
                    onClick={() => openEditor(buildDuplicateDraft(template))}
                  >
                    <Copy size={13} style={{ marginRight: 5 }} />
                    Duplicate
                  </Button>
                  <WorkspaceTooltip content="Removes this starter template from the shared library. You will be asked to confirm." disabled={busy}>
                    <Button
                      type="button"
                      kind="tertiary"
                      size="small"
                      disabled={busy}
                      onClick={() => void runRetire(template)}
                    >
                      <Trash2 size={13} style={{ marginRight: 5 }} />
                      Delete
                    </Button>
                  </WorkspaceTooltip>
                </div>
              </article>
            );
          })}
        </>
      )}
    </section>
  );
}
