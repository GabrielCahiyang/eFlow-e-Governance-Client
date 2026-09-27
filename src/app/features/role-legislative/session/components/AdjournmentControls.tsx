import { useState } from "react";
import { StopFilled, Undo, Warning } from "@carbon/icons-react";
import { FeatureDialog } from "../../../../components/ui/FeatureDialog";

export type SessionState = "pre" | "live" | "suspended" | "adjourned" | "grace";

export function AdjournFrictionModal({
  pendingCount,
  pendingItems,
  sessionLabel,
  onConfirm,
  onCancel,
}: {
  pendingCount: number;
  pendingItems: AgendaItem[];
  sessionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typedText, setTypedText] = useState("");
  const isUnlocked = typedText.toUpperCase() === "ADJOURN";

  return (
    <FeatureDialog onClose={onCancel} title="Destructive Action — Confirm Adjournment" description="This action triggers the BPA Auto-Deferral Engine." contentClassName="!max-w-[480px]" showCloseButton={false}>
      <div className="w-full overflow-hidden bg-white">
        {/* Red header */}
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Warning size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white">Destructive Action — Confirm Adjournment</h3>
            <p className="text-[11px] font-normal text-red-100 mt-0.5">This action triggers the BPA Auto-Deferral Engine</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[12px] font-medium text-amber-900">
              ⚠️ You are about to officially adjourn the <strong>{sessionLabel}</strong>.
            </p>
            {pendingCount > 0 && (
              <p className="text-[12px] font-normal text-amber-800 mt-2">
                You have <strong className="text-red-700">{pendingCount} pending item{pendingCount !== 1 ? "s" : ""}</strong>. If you proceed, these items will be <strong>permanently moved to Unfinished Business</strong> for the next session.
              </p>
            )}
            {pendingCount === 0 && (
              <p className="text-[12px] font-normal text-amber-800 mt-2">
                All agenda items have been concluded. The session record will be sealed.
              </p>
            )}
          </div>

          {/* Items that will be deferred */}
          {pendingCount > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 max-h-[120px] overflow-y-auto">
              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-2">Items to be auto-deferred:</p>
              <div className="space-y-1">
                {pendingItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-[11px] font-normal text-red-800">
                    <span className="text-red-400">→</span>
                    <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-red-500">{item.ref || "—"}</span>
                    <span className="truncate">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Type-to-confirm lock */}
          <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50">
            <p className="text-[11px] font-medium text-neutral-700 mb-2">
              To confirm, type <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] bg-neutral-200 px-1.5 py-0.5 rounded text-red-700 text-[12px]">ADJOURN</span> below:
            </p>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Type ADJOURN to unlock…"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border-2 text-[14px] font-['JetBrains_Mono',_'Fira_Code',_monospace] text-center tracking-[0.2em] outline-none transition-colors placeholder:text-neutral-300 placeholder:tracking-normal placeholder:font-normal placeholder:text-[12px]"
              style={{
                borderColor: typedText === "" ? "#e5e7eb" : isUnlocked ? "#10b981" : "#ef4444",
                backgroundColor: isUnlocked ? "#ecfdf5" : "white",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center gap-3 bg-neutral-50/50">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-medium text-neutral-600 bg-white border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors"
          >
            Cancel — Keep Session Live
          </button>
          <button
            onClick={onConfirm}
            disabled={!isUnlocked}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all ${
              isUnlocked
                ? "bg-red-600 text-white cursor-pointer hover:bg-red-700 shadow-md shadow-red-200"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            <StopFilled size={14} /> Confirm Adjournment
          </button>
        </div>
      </div>
    </FeatureDialog>
  );
}

export function GracePeriodBanner({
  secondsLeft,
  onUndo,
  deferredCount,
}: {
  secondsLeft: number;
  onUndo: () => void;
  deferredCount: number;
}) {
  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = (secondsLeft / 300) * 100;
  const isUrgent = secondsLeft <= 60;

  return (
    <div className={`border rounded-xl p-4 mb-5 transition-colors ${isUrgent ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isUrgent ? "bg-red-100" : "bg-amber-100"}`}>
          <Undo size={20} className={isUrgent ? "text-red-600" : "text-amber-700"} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-semibold ${isUrgent ? "text-red-800" : "text-amber-800"}`}>
              Session Adjourned — Grace Period Active
            </span>
            <span className={`font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[14px] tabular-nums px-2 py-0.5 rounded-md ${
              isUrgent ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
            }`}>
              {minutes}:{secs.toString().padStart(2, "0")}
            </span>
          </div>
          <p className={`text-[11px] font-normal mt-0.5 ${isUrgent ? "text-red-700" : "text-amber-700"}`}>
            {deferredCount} item{deferredCount !== 1 ? "s were" : " was"} moved to Unfinished Business.{" "}
            {isUrgent
              ? "Less than 1 minute remaining — act now!"
              : "Click Undo to reverse the adjournment and restore all items."}
          </p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-amber-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={onUndo}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-emerald-400 text-emerald-700 rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-emerald-50 transition-colors shadow-sm shrink-0"
        >
          <Undo size={14} /> Undo Adjournment
        </button>
      </div>
    </div>
  );
}
import type { AgendaItem } from "./agendaModel";
