import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { formatMinutesDuration } from "../../../shared/systemRuntimeConfig";
import { SESSION_WARNING_LEAD_MS } from "../constants";
import { formatRemainingTime } from "../services/sessionTimeline";

export interface InactivityWarningDialogProps {
  remainingMs: number;
  warningLeadMs?: number;
  timeoutMinutes?: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

export function InactivityWarningDialog({
  remainingMs,
  warningLeadMs = SESSION_WARNING_LEAD_MS,
  timeoutMinutes = 60,
  onStaySignedIn,
  onSignOut,
}: InactivityWarningDialogProps) {
  const shouldReduceMotion = useReducedMotion();
  const safeLead = Math.max(1000, warningLeadMs);
  const progressRatio = Math.max(0, Math.min(1, remainingMs / safeLead));
  const isCritical = remainingMs <= 30_000;
  const isUrgent = !isCritical && remainingMs <= 60_000;
  const timeoutLabel = formatMinutesDuration(timeoutMinutes);

  return (
    <div
      className="fixed inset-0 z-[10050] grid place-items-center bg-[#0a1028]/55 p-4 backdrop-blur-[4px]"
      role="presentation"
    >
      <motion.section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        aria-describedby="idle-warning-description"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[448px] overflow-hidden rounded-[14px] border border-[#d6deed] bg-white text-[#161b35] shadow-[0_24px_64px_rgba(10,16,40,0.28)]"
      >
        {/* Top live countdown progress bar */}
        <div className="h-[3px] w-full bg-[#e8edff]" aria-hidden="true">
          <div
            className="h-full origin-left transition-[transform,background-color] duration-700 ease-linear"
            style={{
              transform: `scaleX(${progressRatio})`,
              backgroundColor: isCritical ? "#c92a3a" : isUrgent ? "#9a6309" : "#00006b",
            }}
          />
        </div>

        {/* Main Content */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border ${
                isCritical
                  ? "border-[#f6c5c2] bg-[#fde9e8] text-[#c92a3a]"
                  : "border-[#f3dca8] bg-[#fff2d8] text-[#795008]"
              }`}
              aria-hidden="true"
            >
              <Clock3 size={20} strokeWidth={2.1} />
            </div>

            <div
              className={`flex flex-col items-end rounded-[8px] border px-3 py-1.5 ${
                isCritical
                  ? "border-[#f6c5c2] bg-[#fde9e8] text-[#c92a3a]"
                  : "border-[#d6deed] bg-[#f5f7fc] text-[#00006b]"
              }`}
              aria-live="polite"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-75">
                Time left
              </span>
              <span className="eflow-tabular text-[20px] font-extrabold leading-tight tracking-[-0.02em]">
                {formatRemainingTime(remainingMs)}
              </span>
            </div>
          </div>

          <h2
            id="idle-warning-title"
            className="mt-4 text-[18px] font-bold leading-snug tracking-[-0.02em] text-[#161b35]"
          >
            Your session is about to expire
          </h2>
          <p
            id="idle-warning-description"
            className="mt-1.5 text-[13px] leading-[1.55] text-[#505c77]"
          >
            For LGU data protection, eFlow signs out inactive accounts after{" "}
            <span className="font-semibold text-[#161b35]">{timeoutLabel}</span> without user
            activity.
          </p>

          <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-[#d6deed] bg-[#f5f7fc] px-3.5 py-3">
            <ShieldCheck
              size={17}
              className="mt-0.5 shrink-0 text-[#00006b]"
              aria-hidden="true"
            />
            <p className="text-[12px] leading-[1.5] text-[#505c77]">
              Background updates and running AI jobs do not extend your session. Any active AI job
              will continue on the server — sign back in to view its result.
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-col-reverse gap-2.5 border-t border-[#e6ecf6] bg-[#f8faff] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d6deed] bg-white px-4 text-[13px] font-semibold text-[#505c77] transition-colors hover:border-[#b8c6e0] hover:bg-[#f0f4fb] hover:text-[#161b35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00006b]"
          >
            <LogOut size={14} aria-hidden="true" />
            <span>Sign out now</span>
          </button>
          <button
            type="button"
            autoFocus
            onClick={onStaySignedIn}
            className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#00006b] px-5 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(0,0,107,0.22)] transition-colors hover:bg-[#00004f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00006b]"
          >
            Stay signed in
          </button>
        </div>
      </motion.section>
    </div>
  );
}
