import { useEffect, useState } from 'react';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { listProjectTaskTemplates, retireProjectTaskTemplate, saveProjectTaskTemplate, type ProjectTaskTemplate } from '../projectTaskTemplates';

export function ProjectTaskTemplateLibrary() {
  const confirmation = useConfirmation();
  const [templates, setTemplates] = useState<ProjectTaskTemplate[]>([]);
  const [editor, setEditor] = useState<ProjectTaskTemplate>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    listProjectTaskTemplates().then(rows => { if (current) setTemplates(rows); })
      .catch(reason => { if (current) setError(reason.message); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, []);

  async function change(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      setEditor(undefined);
      setTemplates(await listProjectTaskTemplates());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the template library.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="mx-auto grid max-w-4xl gap-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">Project task templates</h3><p>Shared checklists for new projects.</p></div>
      <button type="button" className="rounded border px-3 py-2" disabled={busy || !!editor}
        onClick={() => setEditor({ id: '', name: '', groups: [{ title: '', tasks: [{ title: '', subtasks: [] }] }] })}>New template</button>
    </header>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {editor ? <form className="grid gap-4" onSubmit={event => {
      event.preventDefault();
      if (!busy) void change(() => saveProjectTaskTemplate(editor.name, editor.groups.map(group => ({
        ...group, tasks: group.tasks.map(task => ({ ...task, subtasks: task.subtasks.map(item => item.trim()).filter(Boolean) })),
      })), editor.id));
    }}>
      <label className="grid gap-1">Template name<input className="rounded border p-2" required maxLength={120} value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })}/></label>
      {editor.groups.map((group, groupIndex) => {
        const editGroup = (next: typeof group) => setEditor({ ...editor, groups: editor.groups.map((item, index) => index === groupIndex ? next : item) });
        return <fieldset className="grid gap-3 rounded-lg border p-4" key={groupIndex} disabled={busy}>
          <legend className="px-2">Group {groupIndex + 1}</legend>
          <label className="grid gap-1">Group name<input className="rounded border p-2" required maxLength={120} value={group.title} onChange={event => editGroup({ ...group, title: event.target.value })}/></label>
          {group.tasks.map((task, taskIndex) => {
            const editTask = (next: typeof task) => editGroup({ ...group, tasks: group.tasks.map((item, index) => index === taskIndex ? next : item) });
            return <div key={taskIndex} className="grid gap-2 rounded border p-3">
              <label className="grid gap-1">Task name<input className="rounded border p-2" required maxLength={300} value={task.title} onChange={event => editTask({ ...task, title: event.target.value })}/></label>
              <label className="grid gap-1">Subtasks (one per line)<textarea className="rounded border p-2" rows={3} value={task.subtasks.join('\n')} onChange={event => editTask({ ...task, subtasks: event.target.value.split('\n') })}/></label>
              {group.tasks.length > 1 && <button type="button" className="justify-self-start underline" onClick={() => editGroup({ ...group, tasks: group.tasks.filter((_, index) => index !== taskIndex) })}>Remove task</button>}
            </div>;
          })}
          <div className="flex flex-wrap gap-4">
            <button type="button" className="underline" onClick={() => editGroup({ ...group, tasks: [...group.tasks, { title: '', subtasks: [] }] })}>Add task</button>
            {editor.groups.length > 1 && <button type="button" className="underline" onClick={() => setEditor({ ...editor, groups: editor.groups.filter((_, index) => index !== groupIndex) })}>Remove group</button>}
          </div>
        </fieldset>;
      })}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={() => setEditor({ ...editor, groups: [...editor.groups, { title: '', tasks: [{ title: '', subtasks: [] }] }] })}>Add group</button>
        <button type="submit" className="rounded bg-[#087972] px-3 py-2 text-white" disabled={busy}>Save template</button>
        <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={() => setEditor(undefined)}>Cancel</button>
      </div>
    </form> : <>
      {busy && <p role="status">Loading templates…</p>}
      {!busy && !templates.length && !error && <p>No templates yet.</p>}
      {templates.map(template => <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div><strong>{template.name}</strong><p>{template.groups.reduce((count, group) => count + group.tasks.length, 0)} tasks</p></div>
        <div className="flex gap-3">
          <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={() => setEditor(template)}>Edit</button>
          <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={async () => {
            const confirmed = await confirmation.confirm({ title: 'Retire this template?', description: `“${template.name}” will be removed from the shared library. Tasks already added to projects stay in those projects.`, actionLabel: 'Retire template' });
            if (confirmed) void change(() => retireProjectTaskTemplate(template.id));
          }}>Retire</button>
        </div>
      </div>)}
    </>}
  </section>;
}
