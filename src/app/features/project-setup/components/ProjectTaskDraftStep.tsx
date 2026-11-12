import { useRef, useState } from 'react';
import { ClipboardList, Sparkles } from 'lucide-react';
import { ProjectImportSaveError, saveReviewedProject } from '../../project-import';
import { parseProjectTaskGroups, type ProjectTaskGroup, type ProjectTaskTemplate } from '../../work-templates';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { generateProjectTaskGroups, projectSetupTaskPayload } from '../services/projectTaskDraft';
import { FlowError } from './FlowError';

export function ProjectTaskDraftStep({ projectId, project, templates, templateError, initialTemplate, onSaved, onBusyChange }: {
  projectId: string;
  project: { title: string; description: string; scope: string };
  templates: ProjectTaskTemplate[];
  templateError: string;
  initialTemplate?: ProjectTaskTemplate;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [groups, setGroups] = useState<ProjectTaskGroup[]>(initialTemplate?.groups ?? []);
  const [omitted, setOmitted] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<'template' | 'ai'>('template');
  const [template, setTemplate] = useState(initialTemplate?.id ?? '');
  const [busy, setBusy] = useState<'generating' | 'saving'>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
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

  function applyDraft(draft: ProjectTaskGroup[], nextSource: typeof source) {
    setGroups(draft);
    setSource(nextSource);
    setOmitted(new Set());
    setError('');
  }

  const selected = groups.map((group, g) => ({
    ...group,
    tasks: group.tasks.flatMap((task, t) => omitted.has(`${g}/${t}`) ? [] : [{
      ...task, subtasks: task.subtasks.filter((_, s) => !omitted.has(`${g}/${t}/${s}`)),
    }]),
  })).filter(group => group.tasks.length);
  const taskCount = selected.reduce((count, group) => count + group.tasks.length, 0);
  const subtaskCount = selected.flatMap(group => group.tasks).reduce((count, task) => count + task.subtasks.length, 0);

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(kind);
    onBusyChange(true);
    setError('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not finish this action.'); }
    finally { pending.current = false; setBusy(undefined); onBusyChange(false); }
  }

  const save = () => void run('saving', async () => {
    request.current ??= { id: crypto.randomUUID(), payload: projectSetupTaskPayload(selected, source) };
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

  return <section className="pf-task-draft" aria-label="Draft tasks">
    <div><h2>Draft tasks</h2><p>Use a shared template or generate a draft from your project details. Choose the tasks and subtasks you want to add.</p></div>
    <div className="pf-task-draft-options">
      <label><span><ClipboardList size={16}/> Use a template</span>
        <select value={template} disabled={!templates.length || !!busy || retry} onChange={event => {
          try {
            const value = event.target.value;
            const chosen = templates.find(item => item.id === value);
            applyDraft(chosen ? parseProjectTaskGroups(chosen.groups) : [], 'template');
            setTemplate(value);
          } catch (reason) { setError((reason as Error).message); }
        }}>
          <option value="">Choose a template</option>
          {templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <button type="button" disabled={!!busy || retry} onClick={() => void run('generating', async () => {
        applyDraft(await generateProjectTaskGroups(project), 'ai');
        setTemplate('');
      })}><Sparkles size={16}/> {busy === 'generating' ? 'Generating…' : 'Generate with AI'}</button>
    </div>
    {templateError && <p role="status">{templateError}</p>}
    <FlowError error={error}/>
    {groups.map((group, g) => <fieldset key={g} className="pf-task-draft-group" disabled={!!busy || retry}>
      <legend>{group.title}</legend>
      <input aria-label={`Group ${g + 1} name`} value={group.title} maxLength={120}
        onChange={event => setGroups(current => current.map((item, index) => index === g ? { ...item, title: event.target.value } : item))}/>
      {group.tasks.map((task, t) => {
        const key = `${g}/${t}`;
        const included = !omitted.has(key);
        const editTask = (next: typeof task) => setGroups(current => current.map((item, index) =>
          index === g ? { ...item, tasks: item.tasks.map((row, taskIndex) => taskIndex === t ? next : row) } : item));
        return <div className="pf-task-draft-task" key={key}>
          <div><input type="checkbox" aria-label={`Include ${task.title}`} checked={included} onChange={() => toggle(key)}/>
            <input aria-label={`Task ${t + 1} name in group ${g + 1}`} maxLength={300} disabled={!included} value={task.title} onChange={event => editTask({ ...task, title: event.target.value })}/></div>
          {task.subtasks.map((item, s) => <div className="pf-task-draft-subtask" key={s}>
            <input type="checkbox" aria-label={`Include ${item}`} disabled={!included} checked={included && !omitted.has(`${key}/${s}`)} onChange={() => toggle(`${key}/${s}`)}/>
            <input aria-label={`Subtask ${s + 1} for ${task.title}`} maxLength={300} disabled={!included || omitted.has(`${key}/${s}`)} value={item}
              onChange={event => editTask({ ...task, subtasks: task.subtasks.map((value, index) => index === s ? event.target.value : value) })}/>
          </div>)}
        </div>;
      })}
    </fieldset>)}
    {!!groups.length && <footer className="pf-task-draft-options">
      <p>{taskCount} selected {taskCount === 1 ? 'task' : 'tasks'} · {subtaskCount} {subtaskCount === 1 ? 'subtask' : 'subtasks'}</p>
      <button type="button" className="pf-primary" disabled={!taskCount || !!busy} onClick={save}>{busy === 'saving' ? 'Saving…' : retry ? 'Retry saving tasks' : 'Add tasks and open project'}</button>
    </footer>}
  </section>;
}
