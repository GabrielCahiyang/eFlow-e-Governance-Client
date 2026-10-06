import { useEffect, useState } from "react";
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { LockKeyhole, Paperclip, Send } from "lucide-react";
import { BLOCKER_CATEGORIES } from "../../../services/taskDiscussionService";
import type { Subtask } from "../../../services/subtaskService";
import {
  saveSubtaskProgress,
  submitSubtaskForReview,
} from "../services/subtaskWorkflowService";

export function SubtaskProgressForm({
  subtask,
  prerequisite,
  onSaved,
}: {
  subtask: Subtask;
  prerequisite?: Subtask | null;
  onSaved: () => void;
}) {
  const [percent, setPercent] = useState(subtask.percentComplete);
  const [blockerCategory, setBlockerCategory] = useState("None");
  const [blocker, setBlocker] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [savedPercent,setSavedPercent] = useState(subtask.percentComplete);
  const reset = () => {setPercent(subtask.percentComplete);setSavedPercent(subtask.percentComplete);setBlockerCategory('None');setBlocker('');setNextStep('');setNote('');setFiles([]);setError('');};
  const dirty = percent !== savedPercent || blockerCategory !== 'None' || !!blocker || !!nextStep || !!note || files.length > 0;
  const draft = useExplicitDraft('Subtask progress and evidence',dirty,saving,reset);
  useEffect(reset,[subtask.id]);
  useEffect(() => {if (!dirty && !saving) {setPercent(subtask.percentComplete);setSavedPercent(subtask.percentComplete);}},[subtask.percentComplete,dirty,saving]);

  if (prerequisite && !["for_review", "completed"].includes(subtask.status)) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-100 p-3">
        <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-800">
          <LockKeyhole size={14} /> This subtask is locked
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
          Complete “{prerequisite.title}” and receive its assigned reviewer’s approval first. This form will unlock automatically afterward.
        </p>
      </div>
    );
  }

  if (subtask.status === "for_review") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="text-[12px] font-medium text-amber-900">Waiting for the assigned reviewer</div>
        <p className="mt-0.5 text-[11px] text-amber-700">Your note and evidence are locked while the reviewer decides this submission.</p>
      </div>
    );
  }
  if (subtask.status === "completed") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
        Evidence approved. This subtask now counts toward the parent task’s completion.
      </div>
    );
  }

  const isSubmission = percent === 100;
  const handleSave = async () => {
    if (draft.pendingRef.current) return;
    draft.pendingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (isSubmission) {
        await submitSubtaskForReview({ subtaskId: subtask.id, note, evidence: files });
      } else {
        await saveSubtaskProgress({
          subtaskId: subtask.id,
          percentComplete: percent,
          blockerCategory,
          blocker,
          nextStep,
          note,
          attachment: files[0] || null,
        });
      }
      setFiles([]);
      setNote("");
      setBlockerCategory("None");setBlocker("");setNextStep("");setSavedPercent(percent);
      draft.markClean();
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Subtask update failed.");
    } finally {
      draft.pendingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <fieldset disabled={saving} className="min-w-0 rounded-xl border border-neutral-200 bg-white p-3">
      {subtask.status === "changes_requested" && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-800">
          Changes were requested. Update the work and submit a new evidence attempt.
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600">
        <span>Percent complete</span><span className="text-blue-700">{percent}%</span>
      </div>
      <input
        aria-label="Subtask percent complete"
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={(event) => setPercent(Number(event.target.value))}
        className="mt-1 w-full accent-blue-600"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[10.5px] text-neutral-500">
          Blocker
          <select
            value={blockerCategory}
            onChange={(event) => setBlockerCategory(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-[11.5px] outline-none"
          >
            {BLOCKER_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label className="text-[10.5px] text-neutral-500">
          Next step
          <input
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            placeholder="What comes next?"
            className="mt-1 h-9 w-full rounded-lg border border-neutral-200 px-2.5 text-[11.5px] outline-none"
          />
        </label>
      </div>

      {blockerCategory !== "None" && (
        <textarea
          value={blocker}
          onChange={(event) => setBlocker(event.target.value)}
          placeholder="Describe what is blocking this work…"
          className="mt-2 min-h-16 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11.5px] outline-none"
        />
      )}

      <label className="mt-3 block text-[10.5px] text-neutral-500">
        {isSubmission ? "Completion note (required)" : "Progress note (optional)"}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={isSubmission ? "Explain what was completed and what the evidence proves…" : "Add useful context…"}
          className="mt-1 min-h-20 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-[11.5px] outline-none"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 cursor-pointer text-[11px] text-neutral-600">
          <span className="flex items-center gap-1.5"><Paperclip size={13} /> {isSubmission ? "Attach evidence (required)" : "Attach file"}</span>
          <input
            type="file"
            multiple={isSubmission}
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
            className="mt-1 block w-full max-w-[240px] text-[10px] text-neutral-500 file:mr-2 file:rounded file:border-0 file:bg-neutral-100 file:px-2 file:py-1"
          />
          {files.length > 0 && <span className="mt-1 block truncate text-[10px] text-neutral-400">{files.map((file) => file.name).join(", ")}</span>}
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (isSubmission && (!note.trim() || files.length === 0))}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[11.5px] font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          <Send size={13} /> {saving ? "Saving…" : isSubmission ? "Submit for review" : "Save update"}
        </button>
      </div>

      {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</div>}
    </fieldset>
  );
}
