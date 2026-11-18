import { useRef, useState } from 'react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { FormField, SelectInput, TextInput } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/button';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';
import { createProjectGroup, createWorkspaceTask, patchWorkspaceTask } from '../services/workspaceService';
import type { ProjectGroup } from '../types';
import {duplicateWorkNameError} from '../../../shared/workNames';
import {useTasks} from '../../../hooks/useFirebaseData';
import { PrerequisiteField } from '../../../components/ui/workspace/PrerequisiteField';
import { projectPrerequisiteChoices, projectPrerequisiteError } from '../selectors';

/** Explicit creation from the toolbar; inline rows continue creating on blur. */
export function CreateWorkDialog({ kind, projectId, groups, onClose, onCreated }: { kind: 'task' | 'group'; projectId: string; groups: ProjectGroup[]; onClose: () => void; onCreated?: () => void }) {
  const {tasks}=useTasks();
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [created, setCreated] = useState(false);
  const [title, setTitle] = useState(''), [groupId, setGroupId] = useState(groups[0]?.id || ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), originalGroup = useRef(groupId);
  const dirty = !created && (Boolean(title.trim()) || groupId !== originalGroup.current || prerequisites.length > 0);
  useNavigationBlocker({ label: `New ${kind}`, dirty, pending: busy, pendingCheck: () => pending.current, onDiscard: () => { setTitle(''); setError(''); onClose(); } });
  const close = () => { void requestNavigation(() => { if (!dirty) onClose(); }); };
  return <FeatureDialog title={`New ${kind}`} onClose={close} preventClose={busy} contentClassName="pt-small-dialog pt-create-work-dialog">
    <form className="pt-planning-form" aria-busy={busy} onSubmit={event => {
      event.preventDefault();
      if (created || !title.trim() || pending.current || (kind === 'task' && !groupId)) return;
      const issue=duplicateWorkNameError(title,kind==='group'?groups:tasks.filter(task=>task.linkedProjectId===projectId&&task.groupId===groupId),kind==='group'?'Group':'Task');if(issue){setError(issue);return;}
      const dependencyIssue = kind === 'task' ? projectPrerequisiteError(tasks, projectId, '', prerequisites) : '';
      if (dependencyIssue) { setError(dependencyIssue); return; }
      pending.current = true; setBusy(true); setError('');
      void (async () => {
        try {
          if (kind === 'task') {
            const task = await createWorkspaceTask(projectId, groupId, title);
            if (prerequisites.length) {
              try { await patchWorkspaceTask(task.id, { dependency_ids: prerequisites }); }
              catch (reason) {
                setCreated(true);
                setError(`Task created. Open Edit task to verify or save its prerequisites. ${reason instanceof Error ? reason.message : ''}`);
                onCreated?.();
                return;
              }
            }
          }
          else await createProjectGroup(projectId, title, Math.max(-1, ...groups.map(group => group.position)) + 1);
          // Close the committed draft before any refresh; refresh failure must not recreate it.
          setTitle(''); pending.current = false; setBusy(false); onClose(); onCreated?.();
        } catch (caught) { setError(caught instanceof Error ? caught.message : `Could not add ${kind}.`); }
        finally { pending.current = false; setBusy(false); }
      })();
    }}>
      <h2>New {kind}</h2><p>{kind === 'task' ? 'Add work to this project. Appoint its owner and set details in the table.' : 'Organize related tasks without changing their workflow.'}</p>
      <FormField label={kind === 'task' ? 'Task name' : 'Group name'} required error={error}><TextInput autoFocus value={title} maxLength={kind === 'task' ? 300 : 120} disabled={busy || created} onChange={event => setTitle(event.target.value)}/></FormField>
      {kind === 'task' && <><FormField label="Group"><SelectInput value={groupId} options={groups.map(group => ({ value: group.id, label: group.title }))} disabled={busy || created} onChange={event => setGroupId(event.target.value)}/></FormField>
        <PrerequisiteField label="Prerequisite tasks" choices={projectPrerequisiteChoices(tasks, projectId)} selected={prerequisites} disabled={busy || created} onChange={setPrerequisites}/></>}
      <div className="pt-planning-actions"><Button type="button" variant="outline" disabled={busy} onClick={close}>{created ? 'Close' : 'Cancel'}</Button>{!created && <Button disabled={busy || !title.trim() || (kind === 'task' && !groupId)}>{busy ? 'Adding…' : `Add ${kind}`}</Button>}</div>
    </form>
  </FeatureDialog>;
}
