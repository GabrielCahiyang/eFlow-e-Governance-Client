import { Button } from '@vibe/core';
import { Copy, Edit3, FolderPlus, Layers, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
    name: `${source.name} (copy)`.slice(0, 120),
    groups: source.groups.map(group => ({
      title: group.title,
      tasks: group.tasks.map(task => ({
        title: task.title,
        subtasks: [...task.subtasks],
      })),
    })),
  };
}

export function ProjectTaskTemplateLibrary({
  onTemplatesChanged,
  initialCreate = false,
  compactHeader = false,
}: ProjectTaskTemplateLibraryProps = {}) {
  const confirmation = useConfirmation();
  const [templates, setTemplates] = useState<ProjectTaskTemplate[]>([]);
  const [editor, setEditor] = useState<ProjectTaskTemplate | undefined>(() =>
    initialCreate ? createEmptyDraft() : undefined,
  );
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const loadTemplates = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const rows = await listProjectTaskTemplates();
      setTemplates(rows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Templates could not load.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  async function runSave(draft: ProjectTaskTemplate) {
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
      setEditor(undefined);
      const rows = await listProjectTaskTemplates();
      setTemplates(rows);
      onTemplatesChanged?.(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the template library.');
    } finally {
      setBusy(false);
    }
  }

  async function runRetire(template: ProjectTaskTemplate) {
    const confirmed = await confirmation.confirm({
      title: 'Retire this template?',
      description: `“${template.name}” will be removed from the shared library. Tasks already added to projects stay in those projects.`,
      actionLabel: 'Retire template',
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
      setError(reason instanceof Error ? reason.message : 'Could not retire this template.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="eflow-tpl-library" aria-label="Project starter templates">
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
            onClick={() => setEditor(createEmptyDraft())}
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
            <span className="eflow-tpl-tag">
              {editor.groups.length} group{editor.groups.length === 1 ? '' : 's'}
            </span>
          </div>

          <label className="eflow-tpl-field">
            Template name
            <input
              className="eflow-tpl-input"
              required
              maxLength={120}
              placeholder="e.g. Community Outreach Drive"
              value={editor.name}
              onChange={event => setEditor({ ...editor, name: event.target.value })}
            />
          </label>

          {editor.groups.map((group, groupIndex) => {
            const editGroup = (next: typeof group) =>
              setEditor({
                ...editor,
                groups: editor.groups.map((item, index) => (index === groupIndex ? next : item)),
              });
            return (
              <fieldset className="eflow-tpl-group-box" key={groupIndex} disabled={busy}>
                <div className="eflow-tpl-group-head">
                  <span className="eflow-tpl-group-badge">Group {groupIndex + 1}</span>
                  {editor.groups.length > 1 && (
                    <button
                      type="button"
                      className="eflow-tpl-link-btn eflow-tpl-link-btn--danger"
                      onClick={() =>
                        setEditor({
                          ...editor,
                          groups: editor.groups.filter((_, index) => index !== groupIndex),
                        })
                      }
                    >
                      <Trash2 size={13} />
                      Remove group
                    </button>
                  )}
                </div>

                <label className="eflow-tpl-field">
                  Group name
                  <input
                    className="eflow-tpl-input"
                    required
                    maxLength={120}
                    placeholder="e.g. Planning & Approvals"
                    value={group.title}
                    onChange={event => editGroup({ ...group, title: event.target.value })}
                  />
                </label>

                {group.tasks.map((task, taskIndex) => {
                  const editTask = (next: typeof task) =>
                    editGroup({
                      ...group,
                      tasks: group.tasks.map((item, index) => (index === taskIndex ? next : item)),
                    });
                  return (
                    <div key={taskIndex} className="eflow-tpl-task-card">
                      <label className="eflow-tpl-field">
                        Task {taskIndex + 1}
                        <input
                          className="eflow-tpl-input"
                          required
                          maxLength={300}
                          placeholder="e.g. Finalize partner MOU"
                          value={task.title}
                          onChange={event => editTask({ ...task, title: event.target.value })}
                        />
                      </label>

                      <div className="eflow-tpl-subtasks">
                        {task.subtasks.map((subtask, subIndex) => (
                          <div key={subIndex} className="eflow-tpl-subtask-row">
                            <input
                              className="eflow-tpl-input"
                              maxLength={300}
                              aria-label={`Subtask ${subIndex + 1} for ${task.title || `Task ${taskIndex + 1}`}`}
                              placeholder={`Subtask ${subIndex + 1}`}
                              value={subtask}
                              onChange={event =>
                                editTask({
                                  ...task,
                                  subtasks: task.subtasks.map((s, idx) => (idx === subIndex ? event.target.value : s)),
                                })
                              }
                            />
                            <button
                              type="button"
                              className="eflow-tpl-link-btn eflow-tpl-link-btn--danger"
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
                          </div>
                        ))}
                        <div className="eflow-tpl-row-actions">
                          <button
                            type="button"
                            className="eflow-tpl-link-btn"
                            disabled={task.subtasks.length >= 30}
                            onClick={() => editTask({ ...task, subtasks: [...task.subtasks, ''] })}
                          >
                            <Plus size={13} />
                            Add subtask
                          </button>
                          {group.tasks.length > 1 && (
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
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div>
                  <button
                    type="button"
                    className="eflow-tpl-link-btn"
                    onClick={() => editGroup({ ...group, tasks: [...group.tasks, { title: '', subtasks: [] }] })}
                  >
                    <Plus size={13} />
                    Add task to group
                  </button>
                </div>
              </fieldset>
            );
          })}

          <div className="eflow-tpl-row-actions">
            <Button
              type="button"
              kind="secondary"
              size="small"
              disabled={busy}
              onClick={() =>
                setEditor({
                  ...editor,
                  groups: [...editor.groups, { title: '', tasks: [{ title: '', subtasks: [] }] }],
                })
              }
            >
              Add group
            </Button>
            <div className="eflow-tpl-card-actions">
              <Button type="button" kind="tertiary" size="small" disabled={busy} onClick={() => setEditor(undefined)}>
                Cancel
              </Button>
              <Button type="submit" kind="primary" size="small" disabled={busy}>
                Save template
              </Button>
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
                <Button type="button" kind="primary" size="small" onClick={() => setEditor(createEmptyDraft())}>
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
                    onClick={() => setEditor(template)}
                  >
                    <Edit3 size={13} style={{ marginRight: 5 }} />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    kind="secondary"
                    size="small"
                    disabled={busy}
                    onClick={() => setEditor(buildDuplicateDraft(template))}
                  >
                    <Copy size={13} style={{ marginRight: 5 }} />
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    kind="tertiary"
                    size="small"
                    disabled={busy}
                    onClick={() => void runRetire(template)}
                  >
                    <FolderPlus size={13} style={{ marginRight: 5 }} />
                    Retire
                  </Button>
                </div>
              </article>
            );
          })}
        </>
      )}
    </section>
  );
}
