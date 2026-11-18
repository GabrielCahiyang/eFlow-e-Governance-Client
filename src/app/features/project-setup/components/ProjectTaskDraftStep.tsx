import { readableUiError } from '../../../shared/userFacingError';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { BookmarkPlus, ClipboardList, X } from 'lucide-react';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { ProjectImportSaveError, saveReviewedProject } from '../../project-import';
import {
  parseProjectTaskGroups,
  saveProjectTaskTemplate,
  type ProjectTaskGroup,
  type ProjectTaskTemplate,
} from '../../work-templates';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { projectSetupTaskPayload } from '../services/projectTaskDraft';
import { FlowError } from './FlowError';

export function ProjectTaskDraftStep({ projectId, project, templates, templateError, initialTemplate, onTemplateSaved, onSaved, onBusyChange, formId, onSaveStateChange }: {
  projectId: string;
  project: {
    title: string;
    start?: string;
    end?: string;
  };
  templates: ProjectTaskTemplate[];
  templateError: string;
  initialTemplate?: ProjectTaskTemplate;
  onTemplateSaved?: (saved: ProjectTaskTemplate) => void;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
  formId?: string;
  onSaveStateChange?: (state: { label: string; disabled: boolean }) => void;
}) {
  const [groups, setGroups] = useState<ProjectTaskGroup[]>(initialTemplate?.groups ?? []);
  const [omitted, setOmitted] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState(initialTemplate?.id ?? '');
  const [busy, setBusy] = useState<'saving' | 'saving-template'>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savedTemplateNotice, setSavedTemplateNotice] = useState('');
  const request = useRef<{ id: string; payload: ReturnType<typeof projectSetupTaskPayload> } | undefined>(undefined);
  const pending = useRef(false);
  useNavigationBlocker({
    label: 'Draft tasks', identity: projectId, dirty: groups.length > 0, pending: !!busy,
    pendingCheck: () => pending.current, onDiscard: () => { setGroups([]); request.current = undefined; },
  });

  function toggle(key: string) {
    setOmitted(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function removeGroup(gIndex: number) {
    request.current = undefined;
    setGroups(current => current.filter((_, index) => index !== gIndex));
    setOmitted(current => {
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
    setGroups(current => current.map((item, index) =>
      index === gIndex ? { ...item, tasks: item.tasks.filter((_, taskIndex) => taskIndex !== tIndex) } : item));
    setOmitted(current => {
      const next = new Set<string>();
      for (const entry of current) {
        const parts = entry.split('/');
        const g = Number(parts[0]), t = Number(parts[1]);
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
    setGroups(current => current.map((item, index) =>
      index === gIndex ? {
        ...item,
        tasks: item.tasks.map((row, taskIndex) => taskIndex === tIndex
          ? { ...row, subtasks: row.subtasks.filter((_, subIndex) => subIndex !== sIndex) }
          : row),
      } : item));
    setOmitted(current => {
      const next = new Set<string>();
      for (const entry of current) {
        const parts = entry.split('/');
        const g = Number(parts[0]), t = Number(parts[1]), s = parts.length > 2 ? Number(parts[2]) : NaN;
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

  const selected = groups.map((group, g) => ({
    ...group,
    tasks: group.tasks.flatMap((task, t) => omitted.has(`${g}/${t}`) ? [] : [{
      ...task, subtasks: task.subtasks.filter((_, s) => !omitted.has(`${g}/${t}/${s}`)),
    }]),
  })).filter(group => group.tasks.length);
  const taskCount = selected.reduce((count, group) => count + group.tasks.length, 0);
  const subtaskCount = selected.flatMap(group => group.tasks).reduce((count, task) => count + task.subtasks.length, 0);
  useEffect(() => {
    onSaveStateChange?.({label: busy === 'saving' ? 'Saving.' : retry ? 'Retry saving tasks' : taskCount ? 'Add tasks and open project' : 'Open project', disabled: !!busy});
  }, [busy, retry, taskCount, onSaveStateChange]);

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(kind);
    onBusyChange(true);
    setError('');
    try { await action(); }
    catch (reason) { setError(readableUiError(reason, "Could not finish this action.", 'write')); }
    finally { pending.current = false; setBusy(undefined); onBusyChange(false); }
  }

  const save = () => void run('saving', async () => {
    request.current ??= {
      id: crypto.randomUUID(),
      payload: projectSetupTaskPayload(selected, 'template', { startDate: project.start, targetDate: project.end }),
    };
    try {
      const result = await saveReviewedProject('save_project_setup_tasks', projectId, request.current.id, request.current.payload);
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
    onSaved();
  });

  const saveAsTemplate = () => void run('saving-template', async () => {
    const saved = await saveProjectTaskTemplate(saveTemplateName, selected);
    setTemplate(saved.id);
    setSaveTemplateOpen(false);
    setSavedTemplateNotice(`Saved “${saved.name}” to starter templates.`);
    onTemplateSaved?.(saved);
  });

  return <form id={formId} className="pf-task-draft" aria-label="Draft tasks" onSubmit={event => {event.preventDefault();if(!busy&&!pending.current){if(taskCount)save();else onSaved();}}}>
    <div><h2>Draft tasks</h2><p>Use a shared template and choose which tasks and subtasks to add.</p></div>
    <div className="pf-task-draft-options">
      <label><span><ClipboardList size={16}/> Use a template</span>
        <select value={template} disabled={!templates.length || !!busy || retry} onChange={event => {
          try {
            const value = event.target.value;
            const chosen = templates.find(item => item.id === value);
            setGroups(chosen ? parseProjectTaskGroups(chosen.groups) : []);
            setOmitted(new Set());
            setError('');
            setTemplate(value);
          } catch (reason) { setError((reason as Error).message); }
        }}>
          <option value="">Choose a template</option>
          {templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
    {templateError && <p role="status">{templateError}</p>}
    <FlowError error={error}/>
    {groups.map((group, g) => <fieldset key={g} className="pf-task-draft-group" disabled={!!busy || retry}>
      <legend>{group.title}</legend>
      <div className="pf-task-draft-group-row">
        <input aria-label={`Group ${g + 1} name`} value={group.title} maxLength={120}
          onChange={event => setGroups(current => current.map((item, index) => index === g ? { ...item, title: event.target.value } : item))}/>
        <WorkspaceTooltip content="Remove this group">
          <button type="button" className="pf-task-draft-remove" aria-label={`Remove group ${group.title || g + 1}`} onClick={() => removeGroup(g)}>
            <X size={15}/>
          </button>
        </WorkspaceTooltip>
      </div>
      {group.tasks.map((task, t) => {
        const key = `${g}/${t}`;
        const included = !omitted.has(key);
        const editTask = (next: typeof task) => setGroups(current => current.map((item, index) =>
          index === g ? { ...item, tasks: item.tasks.map((row, taskIndex) => taskIndex === t ? next : row) } : item));
        return <div className="pf-task-draft-task" key={key}>
          <div><input type="checkbox" aria-label={`Include ${task.title}`} checked={included} onChange={() => toggle(key)}/>
            <input aria-label={`Task ${t + 1} name in group ${g + 1}`} maxLength={300} disabled={!included} value={task.title} onChange={event => editTask({ ...task, title: event.target.value })}/>
            <WorkspaceTooltip content="Remove this task">
              <button type="button" className="pf-task-draft-remove" aria-label={`Remove task ${task.title || t + 1}`} onClick={() => removeTask(g, t)}>
                <X size={14}/>
              </button>
            </WorkspaceTooltip>
          </div>
          {task.subtasks.map((item, s) => <div className="pf-task-draft-subtask" key={s}>
            <input type="checkbox" aria-label={`Include ${item}`} disabled={!included} checked={included && !omitted.has(`${key}/${s}`)} onChange={() => toggle(`${key}/${s}`)}/>
            <input aria-label={`Subtask ${s + 1} for ${task.title}`} maxLength={300} disabled={!included || omitted.has(`${key}/${s}`)} value={item}
              onChange={event => editTask({ ...task, subtasks: task.subtasks.map((value, index) => index === s ? event.target.value : value) })}/>
            <WorkspaceTooltip content="Remove this subtask">
              <button type="button" className="pf-task-draft-remove" aria-label={`Remove subtask ${item || s + 1}`} onClick={() => removeSubtask(g, t, s)}>
                <X size={13}/>
              </button>
            </WorkspaceTooltip>
          </div>)}
        </div>;
      })}
    </fieldset>)}
    {!!groups.length && (
      <>
        {savedTemplateNotice && (
          <p className="pf-task-draft-save-note" role="status">
            {savedTemplateNotice}
          </p>
        )}
        {saveTemplateOpen && (
          <div className="pf-task-draft-save-bar">
            <input
              aria-label="New starter template name"
              maxLength={120}
              placeholder="Starter template name"
              value={saveTemplateName}
              disabled={!!busy}
              onChange={event => setSaveTemplateName(event.target.value)}
            />
            <Button
              type="button"
              kind="primary"
              size="small"
              disabled={!saveTemplateName.trim() || !taskCount || !!busy}
              onClick={saveAsTemplate}
            >
              {busy === 'saving-template' ? 'Saving template…' : 'Save starter template'}
            </Button>
            <Button
              type="button"
              kind="tertiary"
              size="small"
              disabled={!!busy}
              onClick={() => setSaveTemplateOpen(false)}
            >
              Cancel
            </Button>
          </div>
        )}
        <footer className="pf-task-draft-options">
          <p>
            {taskCount} selected {taskCount === 1 ? 'task' : 'tasks'} · {subtaskCount}{' '}
            {subtaskCount === 1 ? 'subtask' : 'subtasks'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button
              type="button"
              kind="secondary"
              size="small"
              disabled={!taskCount || !!busy || retry}
              onClick={() => {
                setSavedTemplateNotice('');
                setSaveTemplateName(current => current || `${project.title.trim() || 'Project'} starter`.slice(0, 120));
                setSaveTemplateOpen(true);
              }}
            >
              <BookmarkPlus size={15} style={{ marginRight: 5 }} />
              Save as template
            </Button>
            {!formId && <button type="button" className="pf-primary" disabled={!taskCount || !!busy} onClick={save}>
              {busy === 'saving' ? 'Saving…' : retry ? 'Retry saving tasks' : 'Add tasks and open project'}
            </button>}
          </div>
        </footer>
      </>
    )}
  </form>;
}
