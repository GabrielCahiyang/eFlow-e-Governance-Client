import * as React from "react";
import * as Icons from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { archiveProject, restoreProject } from "../services/projectService";
import { useGuardedProjectDialog } from '../hooks/useGuardedProjectDialog';

export function ProjectArchiveDialog({
  projectId,
  projectTitle,
  isArchived,
  open,
  onClose,
  onSuccess,
}: {
  projectId: string;
  projectTitle: string;
  isArchived: boolean;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const inFlight = React.useRef(false);
  const close = useGuardedProjectDialog({ open, dirty: Boolean(reason.trim()), pending: submitting, pendingCheck: () => inFlight.current, label: isArchived ? 'Restore project' : 'Archive project', onClose, onDiscard: () => setReason('') });

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open, projectId]);

  const handleSubmit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (isArchived) {
        await restoreProject(projectId, reason.trim() || "Restored from project workspace");
      } else {
        await archiveProject(projectId, reason.trim() || undefined);
      }
      onSuccess();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : `Failed to ${isArchived ? "restore" : "archive"} project.`,
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={submitting ? () => {} : close}
      title={isArchived ? "Restore project" : "Archive project"}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isArchived
                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                : "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
            }`}
          >
            {submitting && <Icons.Loader2 size={16} className="animate-spin" />}
            {isArchived ? (submitting ? "Restoring…" : "Restore project") : (submitting ? "Archiving…" : "Archive project")}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Banner Alert Card */}
        <div
          className={`flex items-start gap-3.5 p-4 rounded-xl border ${
            isArchived
              ? "bg-blue-50/80 border-blue-200 text-blue-900"
              : "bg-amber-50/80 border-amber-200 text-amber-900"
          }`}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
              isArchived ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
            }`}
          >
            {isArchived ? <Icons.RotateCcw size={18} /> : <Icons.Archive size={18} />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="text-sm font-bold tracking-tight">
              {isArchived ? `Restore "${projectTitle}"` : `Archive "${projectTitle}"`}
            </h4>
            <p className={`mt-1 text-xs leading-relaxed ${isArchived ? "text-blue-700" : "text-amber-800"}`}>
              {isArchived
                ? "Restoring will reactivate this project. Team members will be able to edit tasks, milestones, and project details again."
                : "Only completed projects can be archived. This project will leave the active project list and become read-only. History, reports, audit logs, and restore remain available under Archived projects."}
            </p>
          </div>
        </div>

        {/* Reason field */}
        <div className="flex flex-col gap-2">
          <label htmlFor="archive-reason-input" className="text-xs font-semibold text-neutral-700">
            Reason for {isArchived ? "restoration" : "archiving"} <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="archive-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={submitting}
            placeholder={
              isArchived
                ? "Explain why this project is being reactivated (recorded in audit log)…"
                : "Explain why this project is being archived (recorded in audit log)…"
            }
            className="w-full px-3.5 py-2.5 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-neutral-400 transition-all resize-none"
          />
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" className="flex items-center gap-2 whitespace-pre-line p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <Icons.AlertCircle size={15} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
