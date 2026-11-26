import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, RotateCcw, Upload } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { BoundedTextarea } from "../../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../../components/ui/FieldValidationTooltip";
import { ActionBlockerGroup } from "../../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../../components/ui/workspace/WorkspaceTooltip";
import { attachmentError, EVIDENCE_ACCEPT } from "../../../../shared/fileValidation";
import { INPUT_LIMITS, textLengthError } from "../../../../shared/inputLimits";
import type { Task } from "../../../../services/taskService";
import { RichTextEditor } from "../../../../components/ui/RichTextEditor";
import { SimpleTableEditor } from "../../../../components/ui/SimpleTableEditor";
import { TaskBoardDialog } from "./TaskBoardDialog";

function isEmptyCompletionNote(raw: string): boolean {
  const plain = raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();
  return plain.length === 0;
}

export function SubmitForReviewModal({
  open,
  task,
  note,
  attachments,
  onNoteChange,
  onAttachmentsChange,
  onRemoveAttachment,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  task: Task | null;
  note: string;
  attachments: File[];
  onNoteChange: (value: string) => void;
  onAttachmentsChange: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const noteWrapRef = useRef<HTMLDivElement>(null);
  const noteTooltipId = useId();
  const [noteMode, setNoteMode] = useState<"write" | "table">("write");
  const [noteTouched, setNoteTouched] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  const [noteHovered, setNoteHovered] = useState(false);
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    if (open) {
      setNoteTouched(false);
      setFileError("");
    }
  }, [open, task?.id]);

  if (!open || !task) return null;

  const subtaskCount = task.subtaskCount || 0;
  const approvedSubtaskCount = task.subtaskCompletedCount || 0;
  const remainingSubtasks = Math.max(0, subtaskCount - approvedSubtaskCount);
  const subtasksReady = remainingSubtasks === 0;
  const noteEmpty = isEmptyCompletionNote(note);
  const noteError = noteEmpty ? "Enter a completion note summarizing what was finished." : "";
  const visibleNoteError = noteTouched ? noteError : "";

  const submitBlockers = [
    !subtasksReady
      ? `Complete the remaining ${remainingSubtasks} subtask${remainingSubtasks === 1 ? "" : "s"} before submitting.`
      : "",
    noteEmpty ? "Enter a completion note before submitting for review." : "",
    fileError,
  ].filter(Boolean);
  const submitDisabled = submitting || submitBlockers.length > 0;

  return (
    <TaskBoardDialog
      eyebrow="Submit for review"
      maxWidthClassName="max-w-[640px]"
      onClose={onClose}
      open={open}
      title={task.title}
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} variant="outline">Cancel</Button>
          <ActionBlockerGroup
            actionLabel="Submit for Review"
            blockers={submitBlockers}
            busy={submitting}
            size="md"
          >
            <Button
              type="button"
              disabled={submitDisabled}
              onClick={() => {
                setNoteTouched(true);
                if (submitDisabled) return;
                onSubmit();
              }}
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </ActionBlockerGroup>
        </div>
      )}
    >
      <div className="space-y-4">
        <div
          className={`rounded-xl border px-3 py-2.5 ${
            subtasksReady
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <div className="flex items-center gap-2 text-[11.5px] font-medium">
            <CheckCircle2 size={14} />
            {subtaskCount === 0
              ? "No subtasks to complete"
              : `${approvedSubtaskCount} of ${subtaskCount} subtasks complete`}
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed opacity-80">
            {subtasksReady
              ? "Add the Team Lead’s final completion summary, then submit the complete task to the Head."
              : `${remainingSubtasks} subtask${remainingSubtasks === 1 ? " is" : "s are"} still incomplete. The task cannot be submitted to the Head yet.`}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Completion Note <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setNoteMode("write")}
                className={`text-[10px] px-2 py-0.5 rounded-full ${noteMode === "write" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:bg-neutral-100"}`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setNoteMode("table")}
                className={`text-[10px] px-2 py-0.5 rounded-full ${noteMode === "table" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:bg-neutral-100"}`}
              >
                Table
              </button>
            </div>
          </div>
          <div
            ref={noteWrapRef}
            className={visibleNoteError ? "rounded-xl ring-1 ring-[var(--eflow-danger,#c92a3a)]" : undefined}
            onFocusCapture={() => setNoteFocused(true)}
            onBlurCapture={() => { setNoteFocused(false); setNoteTouched(true); }}
            onMouseEnter={() => setNoteHovered(true)}
            onMouseLeave={() => setNoteHovered(false)}
          >
            {noteMode === "write" ? (
              <RichTextEditor
                value={note}
                onChange={onNoteChange}
                placeholder="Summarize what was completed, results, or evidence details..."
              />
            ) : (
              <SimpleTableEditor onChange={onNoteChange} />
            )}
          </div>
          <FieldValidationTooltip
            id={noteTooltipId}
            anchorRef={noteWrapRef}
            message={visibleNoteError}
            open={Boolean(visibleNoteError) && (noteFocused || noteHovered)}
            tone="error"
          />
          {visibleNoteError && (
            <p role="alert" className="eflow-field-error mt-1 text-xs">
              {visibleNoteError}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                Attachments (optional)
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                Images, PDF, Word or Excel files · up to 25 MB each.
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition"
            >
              <Upload size={11} />
              Add files
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={EVIDENCE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                const chosen = Array.from(e.target.files || []);
                const issue = attachmentError(chosen);
                if (issue) {
                  setFileError(issue);
                } else {
                  setFileError("");
                  onAttachmentsChange(chosen);
                }
                e.target.value = "";
              }}
            />
          </div>
          {fileError && (
            <p role="alert" className="eflow-field-error mt-2 text-xs">
              {fileError}
            </p>
          )}
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between text-[11px] text-neutral-600"
                >
                  <span className="truncate max-w-[380px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => { setFileError(""); onRemoveAttachment(idx); }}
                    className="text-neutral-400 hover:text-neutral-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}
      </div>
    </TaskBoardDialog>
  );
}

export function UndoCompletedModal({
  open,
  task,
  reason,
  onReasonChange,
  onClose,
  onSubmit,
  saving,
  error,
}: {
  open: boolean;
  task: Task | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  error: string;
}) {
  const reasonId = useId();
  const [reasonTouched, setReasonTouched] = useState(false);

  useEffect(() => {
    if (open) setReasonTouched(false);
  }, [open, task?.id]);

  if (!open || !task) return null;

  const reasonError = textLengthError(reason, "Undo reason", { required: true, min: 5, max: INPUT_LIMITS.REASON });
  const visibleReasonError = reasonTouched || reason.trim().length > 0 ? reasonError : "";
  const isDisabled = saving || Boolean(reasonError);

  return (
    <TaskBoardDialog
      eyebrow="Reopen completed task"
      maxWidthClassName="max-w-[480px]"
      onClose={onClose}
      open={open}
      title={task.title}
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} variant="outline">Cancel</Button>
          <ActionBlockerGroup
            actionLabel="Undo completion"
            blockers={isDisabled ? reasonError : []}
            busy={saving}
            size="md"
          >
            <WorkspaceTooltip
              content="Reopens this completed task back to In Progress and notifies the assigned team."
              disabled={isDisabled}
            >
              <Button
                type="button"
                className="bg-[#b65b08] hover:bg-[#8f4706]"
                disabled={isDisabled}
                onClick={() => {
                  setReasonTouched(true);
                  if (isDisabled) return;
                  onSubmit();
                }}
              >
                <RotateCcw />
                {saving ? "Reopening..." : "Undo completion"}
              </Button>
            </WorkspaceTooltip>
          </ActionBlockerGroup>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
          This moves the task back to In Progress and notifies the assigned
          team with your reason.
        </div>
        <div>
          <label htmlFor={reasonId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
            Undo reason <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
          </label>
          <BoundedTextarea
            id={reasonId}
            rows={4}
            aria-required="true"
            maxLength={INPUT_LIMITS.REASON}
            value={reason}
            error={visibleReasonError || undefined}
            onBlur={() => setReasonTouched(true)}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Explain why this completed task needs to be reopened (min. 5 characters)..."
            className="mt-1 min-h-24 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
          />
        </div>
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}
      </div>
    </TaskBoardDialog>
  );
}



// ─── List Board View ──────────────────────────────────────────────
