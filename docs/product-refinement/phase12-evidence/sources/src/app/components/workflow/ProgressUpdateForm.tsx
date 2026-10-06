import { useExplicitDraft } from '../../shared/useExplicitDraft';
// ─── ProgressUpdateForm ──────────────────────────────────────────
// Structured progress report: percent complete, blocker category + free text,
// next step, optional note, optional private attachment. The first non-zero
// update starts a To Do task; final approval remains a separate review action.

import { useState } from "react";
import { Gauge, Paperclip, X, Send } from "lucide-react";
import {
  submitProgressUpdate,
  BLOCKER_CATEGORIES,
} from "../../services/taskDiscussionService";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../ui/Toast";

export function ProgressUpdateForm({
  taskId,
  initialPercent = 0,
  onSaved,
}: {
  taskId: string;
  initialPercent?: number;
  onSaved?: () => void;
}) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [savedPercent, setSavedPercent] = useState(initialPercent);
  const [percent, setPercent] = useState(initialPercent);
  const [blockerCategory, setBlockerCategory] = useState<string>("None");
  const [blocker, setBlocker] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const draftGuard = useExplicitDraft('Task progress update', percent !== savedPercent || blockerCategory !== 'None' || !!blocker || !!nextStep || !!note || !!file, saving, () => { setPercent(savedPercent); setBlockerCategory('None'); setBlocker(''); setNextStep(''); setNote(''); setFile(null); });
  const hasBlocker = blockerCategory !== "None";

  const save = async () => {
    if (draftGuard.pendingRef.current) return;
    if (!user?.id) {
      toast("You must be signed in.", "error");
      return;
    }
    if (hasBlocker && !blocker.trim()) {
      toast("Describe the blocker, or set the category to None.", "error");
      return;
    }
    draftGuard.pendingRef.current = true;
    setSaving(true);
    try {
      await submitProgressUpdate({
        taskId,
        author: { id: user.id, name: userProfile?.full_name || "You" },
        percentComplete: percent,
        blockerCategory,
        blocker,
        nextStep,
        note,
        attachment: file,
      });
      toast("Progress update saved.", "success");
      setBlocker("");
      setNextStep("");
      setNote("");
      setFile(null);
      setBlockerCategory("None");
      setSavedPercent(percent); draftGuard.markClean();
      onSaved?.();
    } catch (e: any) {
      toast(e?.message || "Failed to save progress update.", "error");
    } finally {
      draftGuard.pendingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <fieldset disabled={saving} className="min-w-0 bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <Gauge size={15} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-neutral-900">Post a progress update</div>
          <div className="text-[11px] font-normal text-neutral-500">
            Your first update starts the task. At 100%, submit it to the review queue below.
          </div>
        </div>
      </div>

      {/* Percent complete */}
      <label className="block mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11.5px] font-medium text-neutral-600">Percent complete</span>
          <span className="text-[13px] font-semibold text-blue-700 tabular-nums">{percent}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
      </label>

      {/* Blocker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="text-[11.5px] font-medium text-neutral-600 mb-1 block">Blocker</span>
          <select
            value={blockerCategory}
            onChange={(e) => setBlockerCategory(e.target.value)}
            className="w-full h-9 px-2.5 border border-neutral-200 rounded-lg text-[12px] font-normal text-neutral-800 bg-white focus:outline-none focus:border-neutral-400"
          >
            {BLOCKER_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11.5px] font-medium text-neutral-600 mb-1 block">Next step</span>
          <input
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="What comes next?"
            className="w-full h-9 px-2.5 border border-neutral-200 rounded-lg text-[12px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
          />
        </label>
      </div>

      {hasBlocker && (
        <label className="block mb-3">
          <span className="text-[11.5px] font-medium text-neutral-600 mb-1 block">
            Describe the blocker
          </span>
          <input
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            placeholder="What's blocking you? Your reviewer is notified."
            className="w-full h-9 px-2.5 border border-amber-200 bg-amber-50/40 rounded-lg text-[12px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-amber-400"
          />
        </label>
      )}

      <label className="block mb-3">
        <span className="text-[11.5px] font-medium text-neutral-600 mb-1 block">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add any context…"
          className="w-full resize-none rounded-lg border border-neutral-200 px-2.5 py-2 text-[12px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        {file ? (
          <div className="flex items-center gap-1.5 text-[11.5px] font-normal text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 min-w-0">
            <Paperclip size={12} className="shrink-0" />
            <span className="truncate max-w-[160px]">{file.name}</span>
            <button onClick={() => setFile(null)} className="text-neutral-400 hover:text-neutral-700 shrink-0">
              <X size={12} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer">
            <Paperclip size={13} /> Attach file
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800 disabled:opacity-40"
        >
          <Send size={13} /> {saving ? "Saving…" : "Save update"}
        </button>
      </div>
    </fieldset>
  );
}
