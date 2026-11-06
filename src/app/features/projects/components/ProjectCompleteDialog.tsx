import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { completeProject } from "../services/projectLifecycleService";
import type { Project } from '../services/types';
import { useProjectCompletionAvailability } from '../hooks/useProjectCompletionAvailability';
import { useAuth } from '../../../contexts/AuthContext';
import { ProjectReadinessPanel, type ReadinessDestination } from '../../project-readiness';
import { useGuardedProjectDialog } from '../hooks/useGuardedProjectDialog';
import { CompletionBlockersList } from './CompletionBlockersList';
import { requestNavigation } from '../../../shared/navigationGuard';

export function ProjectCompleteDialog({ projectId, projectTitle, project, onClose, onSuccess, onOpenTask, onOpenGovernance, onResolve, archiveReview = false }: {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenGovernance: (draftId: string) => void;
  project?: Project;
  archiveReview?: boolean;
  onResolve?: (view: ReadinessDestination) => void;
}) {
  const { userProfile } = useAuth();
  const allowed = userProfile?.role === 'head' && userProfile.is_active !== false && (!project || Boolean(project.sourceCollaborationDraftId) || project.orgId === userProfile.org_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const checks = useProjectCompletionAvailability(project || {id:projectId,status:'active',updatedAt:0},allowed,`${userProfile?.id}:${userProfile?.org_id}:${userProfile?.role}`, '', archiveReview);
  const { readiness, loading } = checks;
  const inFlight = useRef(false);
  const close = useGuardedProjectDialog({ dirty: Boolean(note.trim()), pending: busy, pendingCheck: () => inFlight.current, label: 'Project completion note', onClose, onDiscard: () => setNote('') });
  const confirm = async () => {
    if (!checks.enabled || error || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try { await completeProject(projectId, note); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project could not be completed.");
      void checks.refresh();
      setBusy(false); inFlight.current = false;
      return;
    }
    onSuccess();
  };
  return <Modal isOpen onClose={() => { if (!inFlight.current) close(); }} title={archiveReview ? 'Archive requirements' : 'Mark project complete'} width="max-w-2xl" footer={
    <div className="flex w-full flex-wrap justify-end gap-2">
      <button type="button" onClick={close} disabled={busy} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{archiveReview ? 'Close' : 'Cancel'}</button>
      {!archiveReview && <button type="button" disabled={busy || !checks.enabled || Boolean(error)} aria-describedby="project-completion-reason" onClick={() => void confirm()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirm completion
      </button>}
    </div>
  }>
    <div className="space-y-4">
      {archiveReview ? <p className="text-sm text-neutral-700">Current closeout checks for <strong>{projectTitle}</strong>.</p> : <p className="text-sm text-neutral-700">Complete <strong>{projectTitle}</strong>? This changes only this project—not other projects in the work plan. Archiving is a separate step.</p>}
      <p id="project-completion-reason" role="status" className="flex items-center gap-2 text-sm text-neutral-600">{loading ? <><Loader2 size={15} className="animate-spin" />Checking work, cash settlement, and required approvals…</> : readiness && !checks.error ? `${readiness.blockers.length} completion requirement(s) remain.` : checks.reason}</p>
      {(error || checks.error) && <div role="alert" className="whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><p>{error || checks.error}</p><button type="button" disabled={busy || loading} onClick={()=>{setError('');void checks.refresh();}} className="mt-2 underline">Retry checks</button></div>}
      {readiness && <>
        {(readiness.canComplete || archiveReview) && readiness.blockers.length === 0 ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{archiveReview ? 'No outstanding closeout requirements.' : 'All completion checks passed. This project is ready to complete.'}</p> :
          <div className="space-y-3">
            <h4 className="font-semibold text-neutral-900">{archiveReview ? 'Blocking automatic archive' : readiness.status === "archived" ? "This project is already archived." : readiness.status === "completed" ? "This project is already completed." : `${readiness.blockers.length} item(s) still holding up completion`}</h4>
            <CompletionBlockersList blockers={readiness.blockers} highlightId={archiveReview ? readiness.blockers[0]?.id : undefined} busy={busy} project={project} onOpenTask={onOpenTask} onOpenGovernance={onOpenGovernance} onResolve={onResolve} />
          </div>}
      </>}
      {!archiveReview && allowed && project && <ProjectReadinessPanel project={project} canManage={allowed} onUpdated={()=>{setError('');void checks.refresh();}} onResolve={onResolve ? view=>{void requestNavigation(()=>onResolve(view));} : undefined} />}
      {!archiveReview && <label className="block text-sm font-medium">Completion note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={busy || !allowed} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>}
    </div>
  </Modal>;
}
