import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { BoundedTextInput, BoundedTextarea } from "./BoundedInput";
import { Button } from "./button";
import { FeedbackState } from "./FeedbackState";
import { ConfirmationPopoverLayer } from "./OverlayPopoverLayer";
import { WorkspaceTooltip } from "./workspace/WorkspaceTooltip";
import { INPUT_LIMITS } from "../../shared/inputLimits";
import { CheckCircle2, RotateCcw } from 'lucide-react';
import './decisionModal.css';

export interface ConfirmationOptions {
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  warningTooltip?: string;
  tone?: 'approve' | 'return';
  impact?: ReactNode;
  blockers?: string[];
  /** Opt in only when a feature's mutation risk requires it. */
  confirmationText?: string;
  reason?: {
    label: string;
    minLength?: number;
    maxLength?: number;
    placeholder?: string;
    onAccept: (reason: string) => void;
  };
}

/** Resolve confirmation before starting a mutation; cancellation has no side effects. */
export function useConfirmation() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [typed, setTyped] = useState("");
  const [typedTouched, setTypedTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const confirmId = useId();
  const reasonId = useId();
  const reasonValue = useRef("");
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const finish = useCallback((accepted: boolean) => {
    if (accepted && optionsRef.current?.reason) {
      const minLen = optionsRef.current.reason.minLength ?? 1;
      if (reasonValue.current.trim().length < minLen) {
        setReasonTouched(true);
        return;
      }
      optionsRef.current.reason.onAccept(reasonValue.current.trim());
    }
    pending.current?.(accepted);
    pending.current = null;
    setOptions(null);
  }, []);
  useEffect(
    () => () => {
      pending.current?.(false);
    },
    [],
  );
  const confirm = useCallback((next: ConfirmationOptions) => {
    pending.current?.(false);
    setTyped("");
    setTypedTouched(false);
    setReason("");
    setReasonTouched(false);
    reasonValue.current = "";
    setOptions(next);
    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // A menu item unmounts on selection. Return to its persistent trigger.
    const menuId = active?.closest('[role="menu"]')?.id;
    returnFocus.current = menuId
      ? Array.from(
          document.querySelectorAll<HTMLElement>("button[aria-controls]"),
        ).find((button) => button.getAttribute("aria-controls") === menuId) ||
        active
      : active;
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
    });
  }, []);

  const confirmTextTarget = options?.confirmationText || "";
  const confirmTextError =
    confirmTextTarget && (typedTouched || typed.length > 0) && typed !== confirmTextTarget
      ? typed.length === 0
        ? `Type "${confirmTextTarget}" to confirm.`
        : `Text must exactly match "${confirmTextTarget}".`
      : "";

  const reasonMinLen = options?.reason?.minLength ?? 1;
  const reasonMaxLen = options?.reason?.maxLength ?? INPUT_LIMITS.REASON;
  const reasonTrimmed = reason.trim();
  const reasonTooShort = Boolean(options?.reason) && reasonTrimmed.length < reasonMinLen;
  const reasonMissingChars = Math.max(0, reasonMinLen - reasonTrimmed.length);
  const reasonError =
    options?.reason && (reasonTouched || reason.length > 0) && reasonTooShort
      ? reasonTrimmed.length === 0
        ? reasonMinLen > 1
          ? `${options.reason.label} is required (minimum ${reasonMinLen} characters).`
          : `${options.reason.label} is required.`
        : `Enter at least ${reasonMinLen} characters (${reasonMissingChars} more needed).`
      : "";

  const confirmDisabled =
    Boolean(options?.blockers?.length) ||
    Boolean(confirmTextTarget && typed !== confirmTextTarget) ||
    reasonTooShort;

  const confirmTooltip = confirmDisabled
    ? options?.blockers?.[0] ||
      (confirmTextTarget && typed !== confirmTextTarget
        ? `Type "${confirmTextTarget}" to enable confirmation.`
        : reasonTooShort
          ? reasonTrimmed.length === 0
            ? `Enter ${options?.reason?.label?.toLowerCase() || "a reason"} before confirming.`
            : `Enter at least ${reasonMinLen} characters (${reasonMissingChars} more needed).`
          : "")
    : options?.danger
      ? options.warningTooltip || "This action cannot be undone."
      : "";

  const dialog = (
    <ConfirmationPopoverLayer>
      <AlertDialog
        open={Boolean(options)}
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <AlertDialogContent
          data-overlay-layer="confirmation"
          onCloseAutoFocus={(event) => {
            // A parent may close after acceptance; do not let this alert then focus body.
            event.preventDefault();
            if (
              returnFocus.current?.isConnected &&
              !returnFocus.current.closest("[inert]")
            )
              returnFocus.current.focus();
          }}
        >
          <AlertDialogHeader>
            {options?.tone && <span className="decision-modal__icon" data-decision-tone={options.tone}>{options.tone === 'approve' ? <CheckCircle2 size={28}/> : <RotateCcw size={28}/>}</span>}
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {options?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="eflow-confirmation-body eflow-scroll-region">
            {options?.impact && (
              <div className="eflow-confirmation-impact">{options.impact}</div>
            )}
            {Boolean(options?.blockers?.length) && (
              <FeedbackState
                tone="warning"
                title="Resolve these before continuing"
              >
                <ul>
                  {options?.blockers?.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </FeedbackState>
            )}
            {options?.confirmationText && (
              <div className="eflow-field">
                <label htmlFor={confirmId} className="eflow-field__label">
                  Type {options.confirmationText} to confirm{" "}
                  <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                    *
                  </span>
                </label>
                <BoundedTextInput
                  id={confirmId}
                  maxLength={Math.max(INPUT_LIMITS.TITLE, options.confirmationText.length)}
                  value={typed}
                  aria-required="true"
                  error={confirmTextError || undefined}
                  onChange={(event) => setTyped(event.target.value)}
                  onBlur={() => setTypedTouched(true)}
                  autoComplete="off"
                />
              </div>
            )}
            {options?.reason && (
              <div className="eflow-field">
                <label htmlFor={reasonId} className="eflow-field__label">
                  {options.reason.label}{" "}
                  <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                    *
                  </span>
                </label>
                <BoundedTextarea
                  id={reasonId}
                  rows={3}
                  maxLength={reasonMaxLen}
                  value={reason}
                  aria-required="true"
                  placeholder={options.reason.placeholder}
                  error={reasonError || undefined}
                  onChange={(event) => {
                    setReason(event.target.value);
                    reasonValue.current = event.target.value;
                  }}
                  onBlur={() => setReasonTouched(true)}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => finish(false)}>
              {options?.cancelLabel || "Cancel"}
            </AlertDialogCancel>
            <WorkspaceTooltip content={confirmTooltip} disabled={!confirmTooltip}>
              <span className="inline-flex">
                <Button
                  type="button"
                  disabled={confirmDisabled}
                  variant={options?.danger ? "destructive" : "default"}
                  onClick={() => finish(true)}
                >
                  {options?.actionLabel || "Confirm"}
                </Button>
              </span>
            </WorkspaceTooltip>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmationPopoverLayer>
  );
  return { confirm, dialog, cancel: () => finish(false) };
}
