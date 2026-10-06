import * as React from "react";
import * as Icons from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { deleteProject } from "../services/projectService";
import { useGuardedProjectDialog } from '../hooks/useGuardedProjectDialog';

export function ProjectDeleteDialog({
  projectId,
  projectTitle,
  open,
  onClose,
  onDeleted,
}: {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState("");
  const inFlight = React.useRef(false);
  const close = useGuardedProjectDialog({ open, dirty: Boolean(reason.trim() || confirmation.trim()), pending: deleting, pendingCheck: () => inFlight.current, label: 'Delete project', onClose, onDiscard: () => { setReason(''); setConfirmation(''); } });

  React.useEffect(() => {
    if (open) {
      setConfirmation("");
      setReason("");
      setError("");
    }
  }, [open, projectId]);

  const canDelete = confirmation.trim() === projectTitle.trim() && reason.trim().length >= 5;

  const handleDelete = async () => {
    if (!canDelete || inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    setError("");
    try {
      await deleteProject(projectId, confirmation, reason);
      onDeleted();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Project deletion failed.",
      );
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={deleting ? () => {} : close}
      title="Permanently delete project"
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={close}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!canDelete || deleting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting && <Icons.Loader2 size={16} className="animate-spin" />}
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Warning Alert Card */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl border bg-rose-50/80 border-rose-200 text-rose-950">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-rose-100 text-rose-600">
            <Icons.AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="text-sm font-bold tracking-tight text-rose-900">
              This action cannot be undone.
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-rose-700">
              The project, milestones, and membership list will be permanently removed.
              Existing tasks and audit history remain, but their operational project links are cleared.
            </p>
          </div>
        </div>

        {/* Reason for deletion */}
        <div className="flex flex-col gap-2">
          <label htmlFor="delete-reason-input" className="text-xs font-semibold text-neutral-700">
            Reason for deletion <span className="text-rose-500 font-bold">*</span>
          </label>
          <textarea
            id="delete-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={deleting}
            placeholder="Explain why this project must be permanently removed (minimum 5 characters)…"
            className="w-full px-3.5 py-2.5 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-neutral-400 transition-all resize-none"
          />
        </div>

        {/* Confirmation project title */}
        <div className="flex flex-col gap-2">
          <label htmlFor="delete-confirm-input" className="text-xs font-semibold text-neutral-700">
            Type <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 font-bold text-neutral-900">{projectTitle}</span> to confirm <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={deleting}
            placeholder={`Type "${projectTitle}" to confirm`}
            className="w-full px-3.5 py-2.5 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-neutral-400 transition-all"
          />
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <Icons.AlertCircle size={15} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
