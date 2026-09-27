import { useRef, useState } from "react";
import { CheckCircle2, RotateCcw, Upload } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Textarea } from "../../../../components/ui/textarea";
import type { Task } from "../../../../services/taskService";
import { RichTextEditor } from "../../../../components/ui/RichTextEditor";
import { SimpleTableEditor } from "../../../../components/ui/SimpleTableEditor";
import { TaskBoardDialog } from "./TaskBoardDialog";

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
  const [noteMode, setNoteMode] = useState<"write" | "table">("write");

  if (!open || !task) return null;

  const subtaskCount = task.subtaskCount || 0;
  const approvedSubtaskCount = task.subtaskCompletedCount || 0;
  const remainingSubtasks = Math.max(0, subtaskCount - approvedSubtaskCount);
  const subtasksReady = remainingSubtasks === 0;

  return (
    <TaskBoardDialog
      eyebrow="Submit for review"
      maxWidthClassName="max-w-[640px]"
      onClose={onClose}
      open={open}
      title={task.title}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">Cancel</Button>
          <Button disabled={submitting || !subtasksReady} onClick={onSubmit}>
            {submitting ? "Submitting..." : "Submit for Review"}
          </Button>
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
                ? "No subtasks require approval"
                : `${approvedSubtaskCount} of ${subtaskCount} subtasks approved`}
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed opacity-80">
              {subtasksReady
                ? "Add the Team Lead’s final completion summary, then submit the complete task to the Department Head."
                : `${remainingSubtasks} subtask${remainingSubtasks === 1 ? " is" : "s are"} still waiting for Team Leader approval. The task cannot be submitted to the Department Head yet.`}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                Completion Note (required)
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

          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                  Attachments (optional)
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Photos, PDF evidence, or supporting files.
                </div>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition"
              >
                <Upload size={11} />
                Add files
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) =>
                  onAttachmentsChange(Array.from(e.target.files || []))
                }
              />
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between text-[11px] text-neutral-600"
                  >
                    <span className="truncate max-w-[380px]">{file.name}</span>
                    <button
                      onClick={() => onRemoveAttachment(idx)}
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
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
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
  if (!open || !task) return null;

  return (
    <TaskBoardDialog
      eyebrow="Reopen completed task"
      maxWidthClassName="max-w-[480px]"
      onClose={onClose}
      open={open}
      title={task.title}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">Cancel</Button>
          <Button className="bg-[#b65b08] hover:bg-[#8f4706]" disabled={saving} onClick={onSubmit}>
            <RotateCcw />
            {saving ? "Reopening..." : "Undo completion"}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
            This moves the task back to In Progress and notifies the assigned
            team with your reason.
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Undo reason (required)
            </label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Explain why this completed task needs to be reopened..."
              className="mt-1 min-h-24"
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
      </div>
    </TaskBoardDialog>
  );
}



// ─── List Board View ──────────────────────────────────────────────
