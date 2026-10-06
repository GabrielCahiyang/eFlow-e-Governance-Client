import { useRef, useState } from 'react';
import { FeatureDialog } from '../../../../components/ui/FeatureDialog';
import { Button } from '../../../../components/ui/button';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { FormField, TextInput, SelectInput } from '../../../../components/ui/FormField';
import { requestNavigation, useNavigationBlocker } from '../../../../shared/navigationGuard';
import { updateProject } from '../../services/projectMutationService';
import type { Project, ProjectPriority } from '../../services/types';
import { projectOperationError } from '../../presentation/projectOperationError';

function editableDetails(project: Project) {
  return { title: project.title, description: project.description || '', priority: project.priority, startDate: project.startDate || '', targetDate: project.targetDate || '' };
}

/** Existing project metadata only; lifecycle, ownership and Office access use their own workflows. */
export function ProjectSettingsDialog({ project, canManage, onClose }: { project: Project; canManage: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(() => editableDetails(project));
  const [saved, setSaved] = useState(() => editableDetails(project));
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const closed = ['completed', 'archived'].includes(project.status);
  const editable = canManage && !closed;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useNavigationBlocker({ label: 'Project settings', dirty, pending, pendingCheck: () => inFlight.current, onDiscard: () => { setDraft(saved); onClose(); } });
  const close = () => { void requestNavigation(() => { if (!dirty) onClose(); }); };
  const save = async () => {
    if (!editable || inFlight.current || !dirty) return;
    if (!draft.title.trim()) { setError('Enter a project name.'); return; }
    if (draft.startDate && draft.targetDate && draft.targetDate < draft.startDate) { setError('Target date must be on or after the start date.'); return; }
    inFlight.current = true; setPending(true); setError(''); setNotice('');
    try {
      const next = { ...draft, title: draft.title.trim() };
      const changes = Object.fromEntries(Object.entries(next).filter(([field, value]) => value !== saved[field as keyof typeof saved])) as Partial<typeof next>;
      await updateProject(project.id, changes);
      setDraft(next); setSaved(next); setNotice('Project settings saved.');
    } catch (caught) { setError(projectOperationError(caught, 'Could not save project settings. Your changes are retained.')); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <FeatureDialog title="Project settings" onClose={close} preventClose={pending} contentClassName="eflow-project-settings">
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <header><h2>Project settings</h2><p>{project.title}</p></header>
      <div className="eflow-project-settings__fields">
        {!editable && <FeedbackState title={closed ? 'Closed project' : 'Read-only project'}>{closed ? 'Completed and archived project details are read-only. History and reports remain available.' : 'Only authorized project managers can edit these details.'}</FeedbackState>}
        <FormField label="Project name" required error={error === 'Enter a project name.' ? error : undefined}><TextInput value={draft.title} maxLength={200} disabled={!editable || pending} onChange={event => setDraft({ ...draft, title: event.target.value })} /></FormField>
        <FormField label="Description"><textarea className="eflow-form-input" rows={3} value={draft.description} disabled={!editable || pending} onChange={event => setDraft({ ...draft, description: event.target.value })} /></FormField>
        <FormField label="Priority"><SelectInput value={draft.priority} disabled={!editable || pending} options={['low','medium','high'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} onChange={event => setDraft({ ...draft, priority: event.target.value as ProjectPriority })} /></FormField>
        <div className="eflow-project-settings__dates">
          <FormField label="Start date"><TextInput type="date" value={draft.startDate} disabled={!editable || pending} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></FormField>
          <FormField label="Target date" error={error === 'Target date must be on or after the start date.' ? error : undefined}><TextInput type="date" value={draft.targetDate} disabled={!editable || pending} onChange={event => setDraft({ ...draft, targetDate: event.target.value })} /></FormField>
        </div>
        <p>Office access, staffing and readiness reviews stay in their existing project tools. Saving material changes may require another readiness review.</p>
        {error && <FeedbackState tone="error" title="Settings could not be saved">{error} Retry with Save changes.</FeedbackState>}
        {notice && <FeedbackState tone="success" title={notice} />}
      </div>
      <footer><Button type="button" variant="outline" disabled={pending} onClick={close}>Close</Button>{editable && <Button type="submit" pending={pending} disabled={!dirty}>Save changes</Button>}</footer>
    </form>
  </FeatureDialog>;
}
