import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Clock3,
  OctagonAlert,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  formatManilaDate,
  formatManilaDateTime,
} from "../../../shared/calendarDisplay";
import { isCalendarDate } from "../../../shared/calendarDates";
import { BLOCKER_CATEGORY_META } from "./classifyBlocker";
import type { ActionBlockerCategory, ActionBlockerItem } from "./types";
import "./actionBlockers.css";

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPesoSafe(amount: number): string {
  const centavos = Math.round(amount * 100);
  return pesoFormatter.format(centavos / 100);
}

function formatBlockerDue(dueAt: string | number): string {
  if (typeof dueAt === "number") {
    return formatManilaDateTime(dueAt, String(dueAt));
  }
  if (isCalendarDate(dueAt)) {
    return formatManilaDate(dueAt, dueAt);
  }
  return formatManilaDateTime(dueAt, dueAt);
}

function CategoryIcon({ category }: { category: ActionBlockerCategory }) {
  switch (category) {
    case "head_approval":
    case "lead_review":
    case "partner_approval":
    case "admin_approval":
      return <UserCheck size={15} aria-hidden="true" />;
    case "accounting_approval":
    case "financial_gate":
      return <Wallet size={15} aria-hidden="true" />;
    case "separation_of_duties":
    case "permission":
      return <ShieldAlert size={15} aria-hidden="true" />;
    case "dependency":
      return <Clock3 size={15} aria-hidden="true" />;
    default:
      return <OctagonAlert size={15} aria-hidden="true" />;
  }
}

export interface ActionBlockersModalProps {
  open: boolean;
  actionLabel: string;
  blockers: ActionBlockerItem[];
  onClose: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ActionBlockersModal({
  open,
  actionLabel,
  blockers,
  onClose,
  onRefresh,
  refreshing = false,
}: ActionBlockersModalProps) {
  const titleId = useId();
  const descId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const count = blockers.length;
  const normalizedAction = actionLabel.trim() || "this action";

  return createPortal(
    <div
      className="eflow-blocker-modal-backdrop"
      data-slot="action-blockers-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.stopPropagation();
          onClose();
        }
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-slot="action-blockers-modal"
        className="eflow-blocker-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="eflow-blocker-modal__header">
          <div className="eflow-blocker-modal__heading">
            <span className="eflow-blocker-modal__emblem" aria-hidden="true">
              <OctagonAlert size={20} />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="eflow-blocker-modal__title">
                Action blocked: {normalizedAction}
              </h2>
              <p id={descId} className="eflow-blocker-modal__subtitle">
                {count === 1
                  ? "1 blocker must be resolved before you can continue."
                  : `${count} blockers must be resolved before you can continue.`}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="eflow-blocker-modal__close"
            aria-label="Close blockers modal"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="eflow-blocker-modal__body">
          <ul className="eflow-blocker-modal__list">
            {blockers.map((blocker) => {
              const meta = BLOCKER_CATEGORY_META[blocker.category];
              const waitingOn = blocker.waitingOn || meta?.defaultWaitingOn;
              const statusTag = blocker.statusLabel || meta?.badge;
              return (
                <li
                  key={blocker.id}
                  className="eflow-blocker-card"
                  data-category={blocker.category}
                >
                  <div className="eflow-blocker-card__icon">
                    <CategoryIcon category={blocker.category} />
                  </div>
                  <div className="eflow-blocker-card__content">
                    <div className="eflow-blocker-card__top">
                      <strong className="eflow-blocker-card__title">
                        {blocker.title}
                      </strong>
                      {statusTag && (
                        <span className="eflow-blocker-card__tag">
                          {statusTag}
                        </span>
                      )}
                    </div>
                    {blocker.detail && blocker.detail !== blocker.title && (
                      <p className="eflow-blocker-card__detail">
                        {blocker.detail}
                      </p>
                    )}
                    <div className="eflow-blocker-card__meta">
                      {waitingOn && (
                        <span className="eflow-blocker-card__meta-item">
                          <strong>Waiting on:</strong> {waitingOn}
                        </span>
                      )}
                      {typeof blocker.amount === "number" &&
                        Number.isFinite(blocker.amount) && (
                          <span className="eflow-blocker-card__meta-item tabular-nums">
                            <strong>Amount:</strong>{" "}
                            {formatPesoSafe(blocker.amount)}
                          </span>
                        )}
                      {blocker.dueAt && (
                        <span className="eflow-blocker-card__meta-item tabular-nums">
                          <strong>Schedule / Due:</strong>{" "}
                          {formatBlockerDue(blocker.dueAt)}
                        </span>
                      )}
                    </div>
                    {blocker.actionLabel && blocker.onAction && (
                      <div className="eflow-blocker-card__action">
                        <button
                          type="button"
                          className="eflow-blocker-card__jump"
                          onClick={() => {
                            onClose();
                            blocker.onAction?.();
                          }}
                        >
                          <span>{blocker.actionLabel}</span>
                          <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="eflow-blocker-modal__footer">
          {onRefresh && (
            <button
              type="button"
              className="eflow-blocker-modal__refresh"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={refreshing ? "animate-spin" : undefined}
              />
              <span>{refreshing ? "Checking…" : "Recheck blockers"}</span>
            </button>
          )}
          <button
            type="button"
            className="eflow-blocker-modal__done"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
