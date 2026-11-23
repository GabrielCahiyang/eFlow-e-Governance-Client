import * as Carbon from "@carbon/icons-react";
import * as Lucide from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import type { TaskCard } from "./councilorData";

export function ConfirmationPad({
  task,
  action,
  onConfirm,
  onCancel,
}: {
  task: TaskCard;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const pinGroupRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const pinTooltipId = useId();

  const appendDigit = useCallback((digit: string) => {
    setPinError("");
    setPin((current) => (current.length < 4 ? current + digit : current));
  }, []);

  const deleteDigit = useCallback(() => {
    setPinError("");
    setPin((current) => current.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (pin.length === 4) {
      setPinError("");
      onConfirm();
    } else {
      setPinError("Please enter a valid 4-digit PIN.");
    }
  }, [pin.length, onConfirm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        deleteDigit();
      } else if (event.key === "Enter") {
        if (document.activeElement?.tagName !== "BUTTON") {
          event.preventDefault();
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appendDigit, deleteDigit, handleSubmit, onCancel]);

  const actionLabels: Record<string, { label: string; color: string }> = {
    vote_yes: { label: "Vote: YES", color: "text-emerald-600" },
    vote_no: { label: "Vote: NO", color: "text-red-600" },
    abstain: { label: "Vote: ABSTAIN", color: "text-neutral-600" },
    sign_favorable: { label: "Action: Favorable Recommendation", color: "text-emerald-600" },
    return_revisions: { label: "Action: Returned for Revisions", color: "text-amber-600" },
  };

  const actionInfo = actionLabels[action] || { label: action, color: "text-neutral-600" };
  const isVote = task.type === "Floor Vote";
  const pinComplete = pin.length === 4;
  const submitTooltip = !pinComplete
    ? "Enter your 4-digit PIN to continue."
    : isVote
      ? "Casts your vote and seals it permanently in the immutable ledger. This cannot be undone."
      : "Applies your digital signature and seals this action in the immutable ledger. This cannot be undone.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(12px)", background: "rgba(0,0,0,0.3)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="bg-white rounded-3xl p-8 w-full max-w-[380px] shadow-2xl mx-4"
      >
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="size-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Lucide.Shield size={32} className="text-emerald-500" />
          </div>
        </div>

        <h3 id={titleId} className="text-[18px] font-normal text-neutral-900 text-center mb-1">
          {isVote ? "Confirm Your Vote" : "Digital Signature Required"}
        </h3>
        <p id={descriptionId} className="text-[13px] font-normal text-neutral-500 text-center mb-6">
          {isVote ? "Enter your 4-digit PIN to cast your vote" : "Enter your 4-digit PIN to seal your approval"}
        </p>

        {/* Document Info */}
        <div className="bg-neutral-50 rounded-xl p-4 mb-6">
          <p className="text-[11px] font-normal text-neutral-400 uppercase tracking-wider mb-1">
            {isVote ? "Voting on" : "Signing"}
          </p>
          <p className="text-[13px] font-normal text-neutral-700">
            {task.title}
          </p>
          <p className={`text-[11px] font-normal ${actionInfo.color} mt-2 flex items-center gap-1`}>
            <Carbon.CheckmarkOutline size={12} />
            {actionInfo.label}
          </p>
        </div>

        {/* PIN Input */}
        <div className="mb-5">
          <div
            ref={pinGroupRef}
            role="group"
            aria-label="4-digit PIN"
            aria-describedby={pinError ? pinTooltipId : undefined}
            className="flex justify-center gap-3"
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`size-14 rounded-xl border-2 flex items-center justify-center text-[24px] font-normal transition-all duration-200 ${
                  pinError
                    ? "border-red-400 bg-red-50"
                    : pin.length > i
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                {pin.length > i ? "•" : ""}
              </div>
            ))}
          </div>
          <FieldValidationTooltip
            id={pinTooltipId}
            anchorRef={pinGroupRef}
            message={pinError}
            open={Boolean(pinError)}
            tone="error"
          />
          <div className="mt-2 flex items-center justify-between text-[11.5px]">
            <span className="text-neutral-400">4-digit confirmation PIN</span>
            <span
              className={`tabular-nums font-medium ${pinComplete ? "text-emerald-600" : "text-neutral-500"}`}
              aria-live="polite"
            >
              {pin.length} / 4
            </span>
          </div>
          {pinError && (
            <p role="alert" className="mt-2 text-[12px] font-medium text-red-600 text-center">
              {pinError}
            </p>
          )}
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((num, i) => {
            if (num === null) return <div key={i} />;
            return (
              <button
                key={i}
                type="button"
                aria-label={num === "del" ? "Delete last digit" : undefined}
                onClick={() => {
                  if (num === "del") deleteDigit();
                  else appendDigit(String(num));
                }}
                className="py-3 rounded-xl bg-neutral-50 text-[18px] font-normal text-neutral-700 cursor-pointer hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
              >
                {num === "del" ? "←" : num}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl text-[14px] font-normal cursor-pointer hover:bg-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <WorkspaceTooltip content={submitTooltip} disabled={!submitTooltip}>
            <span
              className={`inline-flex flex-1${!pinComplete ? " cursor-not-allowed" : ""}`}
              onClick={() => {
                if (!pinComplete) {
                  setPinError("Please enter a valid 4-digit PIN.");
                }
              }}
            >
              <button
                type="button"
                disabled={!pinComplete}
                onClick={handleSubmit}
                className={`w-full py-3 rounded-xl text-[14px] font-normal transition-all disabled:pointer-events-none ${
                  pinComplete
                    ? "bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700"
                    : "bg-neutral-200 text-neutral-400"
                }`}
              >
                {isVote ? "Cast Vote" : "Confirm & Seal"}
              </button>
            </span>
          </WorkspaceTooltip>
        </div>

        <p className="text-[10px] font-normal text-neutral-400 text-center mt-4 flex items-center justify-center gap-1">
          <Carbon.Locked size={10} />
          Cryptographically sealed via eFlow Immutable Ledger
        </p>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
