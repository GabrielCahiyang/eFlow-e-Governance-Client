import { ArrowRight, CalendarCheck2, CheckCircle2, LockKeyhole, RefreshCw, Wallet } from "lucide-react";
import { Modal, ModalButton } from "../../../components/ui/Modal";
import { FeedbackState } from "../../../components/ui/FeedbackState";

export type OfficeBudgetGateReason = "missing" | "draft" | "closed";

export function OfficeBudgetRequiredModal({
  isOpen,
  fiscalYear,
  reason,
  importPdf,
  loading = false,
  error = "",
  canConfigureBudget = true,
  onRetry,
  onConfigureBudget,
  onClose,
}: {
  isOpen: boolean;
  fiscalYear: number;
  reason: OfficeBudgetGateReason;
  importPdf?: boolean;
  loading?: boolean;
  error?: string;
  canConfigureBudget?: boolean;
  onRetry?: () => void;
  onConfigureBudget?: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  if (loading) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Preparing project setup"
        width="max-w-md"
        footer={<ModalButton onClick={onClose}>Cancel</ModalButton>}
      >
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3.5 rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-4 py-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet size={18} className="animate-pulse" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--eflow-text)]">
              Checking FY {fiscalYear} Office Budget…
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--eflow-text-muted)]">
              Verifying that this year’s annual budget is configured and ready.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Unable to verify Office Budget"
        width="max-w-md"
        footer={
          <>
            <ModalButton onClick={onClose}>Close</ModalButton>
            {onRetry && (
              <ModalButton variant="primary" onClick={onRetry}>
                <RefreshCw size={14} aria-hidden="true" /> Try again
              </ModalButton>
            )}
          </>
        }
      >
        <FeedbackState tone="error" title={`Could not check FY ${fiscalYear} Office Budget`}>
          {error} Please try again before creating a new project.
        </FeedbackState>
      </Modal>
    );
  }

  const copy =
    reason === "draft"
      ? {
          title: `Finalize your FY ${fiscalYear} Office Budget first`,
          badge: `FY ${fiscalYear} · Draft`,
          badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
          iconBg: "bg-amber-50 text-amber-700 border-amber-200/80",
          Icon: LockKeyhole,
          lead: `Your FY ${fiscalYear} Office Budget is saved as a draft, but it needs to be locked before you can create a new project${importPdf ? " with AI" : ""}.`,
          cta: "Review & lock Office Budget",
        }
      : reason === "closed"
        ? {
            title: `FY ${fiscalYear} Office Budget is closed`,
            badge: `FY ${fiscalYear} · Closed`,
            badgeClass: "border-neutral-200 bg-neutral-100 text-neutral-700",
            iconBg: "bg-neutral-100 text-neutral-700 border-neutral-200",
            Icon: CalendarCheck2,
            lead: `The Office Budget for FY ${fiscalYear} is currently closed. Please review your budget configuration before starting a new project${importPdf ? " with AI" : ""}.`,
            cta: "Open Office Budget",
          }
        : {
            title: `Set up your FY ${fiscalYear} Office Budget first`,
            badge: `FY ${fiscalYear} · Not yet configured`,
            badgeClass: "border-primary/20 bg-primary/10 text-primary",
            iconBg: "bg-primary/10 text-primary border-primary/20",
            Icon: Wallet,
            lead: `Before creating a new project${importPdf ? " with AI" : ""}, please configure and lock your Office Budget for FY ${fiscalYear}. Setting it up first ensures project funding, task allocations, and expenses stay accurate from the start.`,
            cta: "Configure Office Budget",
          };

  const StatusIcon = copy.Icon;
  const steps =
    reason === "draft"
      ? [
          { label: `Open FY ${fiscalYear} Annual Budget`, detail: "Review your saved budget lines and fund sources." },
          { label: "Lock the annual budget", detail: "Confirm your figures so project funding can reserve from it." },
          { label: "Return to create your project", detail: "Both manual project setup and AI proposal import unlock immediately." },
        ]
      : [
          { label: `Open Office Budget for FY ${fiscalYear}`, detail: "Go straight to Annual Budget setup for this fiscal year." },
          { label: "Add and lock your budget lines", detail: "Configure this year’s approved allocations and lock the budget." },
          { label: "Start creating projects", detail: "Create projects manually or with AI with verified funding ready." },
        ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={copy.title}
      width="max-w-lg"
      footer={
        <>
          <ModalButton onClick={onClose}>{canConfigureBudget ? "Not now" : "Close"}</ModalButton>
          {canConfigureBudget && onConfigureBudget && (
            <ModalButton variant="primary" onClick={onConfigureBudget}>
              {copy.cta} <ArrowRight size={14} aria-hidden="true" />
            </ModalButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3.5 rounded-2xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)]/70 p-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${copy.iconBg}`}
            aria-hidden="true"
          >
            <StatusIcon size={20} />
          </span>
          <div className="min-w-0 space-y-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight ${copy.badgeClass}`}
            >
              {copy.badge}
            </span>
            <p className="text-[13px] leading-relaxed text-[var(--eflow-text-secondary)]">
              {copy.lead}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--eflow-text-muted)]">
            Quick setup steps
          </p>
          <ol className="space-y-2.5">
            {steps.map((step, index) => (
              <li key={step.label} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-[var(--eflow-text)]">
                    {step.label}
                  </div>
                  <div className="text-[11.5px] leading-4 text-[var(--eflow-text-muted)]">
                    {step.detail}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {!canConfigureBudget && (
          <p className="flex items-center gap-2 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3 py-2.5 text-[12px] text-[var(--eflow-text-muted)]">
            <CheckCircle2 size={15} className="shrink-0 text-primary" aria-hidden="true" />
            Please ask your Office Head to configure and lock the FY {fiscalYear} Office Budget first.
          </p>
        )}
      </div>
    </Modal>
  );
}
