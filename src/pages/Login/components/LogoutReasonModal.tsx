import { useEffect } from "react";
import { Clock3, LogOut, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  formatLogoutTimestamp,
  type LogoutNotice,
} from "../../../app/features/session-security/services/logoutNotice";

export interface LogoutReasonModalProps {
  notice: LogoutNotice | null;
  isAdminPortal?: boolean;
  onDismiss: () => void;
}

function getToneStyles(notice: LogoutNotice) {
  switch (notice.tone) {
    case "danger":
      return {
        barColor: "#c92a3a",
        iconChipClass: "border-[#f6c5c2] bg-[#fde9e8] text-[#c92a3a]",
        badgeClass: "border-[#f6c5c2] bg-[#fde9e8] text-[#c92a3a]",
        detailIconClass: "text-[#c92a3a]",
      };
    case "warning":
      return {
        barColor: "#9a6309",
        iconChipClass: "border-[#f3dca8] bg-[#fff2d8] text-[#795008]",
        badgeClass: "border-[#f3dca8] bg-[#fff2d8] text-[#795008]",
        detailIconClass: "text-[#00006b]",
      };
    default:
      return {
        barColor: "#00006b",
        iconChipClass: "border-[#c5d4ff] bg-[#e8edff] text-[#00006b]",
        badgeClass: "border-[#c5d4ff] bg-[#e8edff] text-[#00006b]",
        detailIconClass: "text-[#00006b]",
      };
  }
}

function renderReasonIcon(notice: LogoutNotice) {
  switch (notice.reason) {
    case "inactivity":
      return <Clock3 size={20} strokeWidth={2.1} />;
    case "deactivated":
    case "session_expired":
      return <ShieldAlert size={20} strokeWidth={2.1} />;
    default:
      return <LogOut size={20} strokeWidth={2.1} />;
  }
}

export function LogoutReasonModal({
  notice,
  isAdminPortal = false,
  onDismiss,
}: LogoutReasonModalProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!notice) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notice, onDismiss]);

  const tone = notice ? getToneStyles(notice) : null;
  const formattedTime = notice ? formatLogoutTimestamp(notice.occurredAt) : "";
  const portalLabel = isAdminPortal ? "eFlow Admin" : "eFlow";

  return (
    <AnimatePresence>
      {notice && tone && (
        <motion.div
          key="logout-reason-backdrop"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-[10050] grid place-items-center bg-[#0a1028]/55 p-4 backdrop-blur-[4px]"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onDismiss();
          }}
        >
          <motion.section
            key="logout-reason-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-reason-title"
            aria-describedby="logout-reason-description"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[448px] overflow-hidden rounded-[14px] border border-[#d6deed] bg-white text-[#161b35] shadow-[0_24px_64px_rgba(10,16,40,0.28)]"
          >
            {/* Top semantic accent bar */}
            <div
              className="h-[3px] w-full"
              style={{ backgroundColor: tone.barColor }}
              aria-hidden="true"
            />

            {/* Main content */}
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border ${tone.iconChipClass}`}
                    aria-hidden="true"
                  >
                    {renderReasonIcon(notice)}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex w-fit items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.07em] ${tone.badgeClass}`}
                    >
                      {notice.badge}
                    </span>
                    <span className="text-[11px] font-medium text-[#5e6b85]">
                      {portalLabel}
                      {formattedTime ? ` · ${formattedTime}` : ""}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Close sign-out notice"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-transparent text-[#5e6b85] transition-colors hover:border-[#d6deed] hover:bg-[#f5f7fc] hover:text-[#161b35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00006b]"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <h2
                id="logout-reason-title"
                className="mt-4 text-[18px] font-bold leading-snug tracking-[-0.02em] text-[#161b35]"
              >
                {notice.title}
              </h2>
              <p
                id="logout-reason-description"
                className="mt-1.5 text-[13px] leading-[1.55] text-[#505c77]"
              >
                {notice.message}
              </p>

              {notice.detail && (
                <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-[#d6deed] bg-[#f5f7fc] px-3.5 py-3">
                  {notice.tone === "danger" ? (
                    <ShieldAlert
                      size={17}
                      className={`mt-0.5 shrink-0 ${tone.detailIconClass}`}
                      aria-hidden="true"
                    />
                  ) : (
                    <ShieldCheck
                      size={17}
                      className={`mt-0.5 shrink-0 ${tone.detailIconClass}`}
                      aria-hidden="true"
                    />
                  )}
                  <p className="text-[12px] leading-[1.5] text-[#505c77]">{notice.detail}</p>
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="flex justify-end border-t border-[#e6ecf6] bg-[#f8faff] px-6 py-4">
              <button
                type="button"
                autoFocus
                onClick={onDismiss}
                className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#00006b] px-5 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(0,0,107,0.22)] transition-colors hover:bg-[#00004f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00006b]"
              >
                {notice.reason === "deactivated" ? "Understood" : "Continue to sign in"}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
