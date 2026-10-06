import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./alert-dialog";
import { FormField, TextInput } from "./FormField";
import { Button } from "./button";
import { FeedbackState } from "./FeedbackState";
import { ConfirmationPopoverLayer } from "./OverlayPopoverLayer";

interface ConfirmationOptions {
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  impact?: ReactNode;
  blockers?: string[];
  /** Opt in only when a feature's mutation risk requires it. */
  confirmationText?: string;
}

/** Resolve confirmation before starting a mutation; cancellation has no side effects. */
export function useConfirmation() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [typed, setTyped] = useState("");
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const finish = useCallback((accepted: boolean) => {
    pending.current?.(accepted); pending.current = null; setOptions(null);
  }, []);
  useEffect(() => () => { pending.current?.(false); }, []);
  const confirm = useCallback((next: ConfirmationOptions) => {
    pending.current?.(false); setTyped(""); setOptions(next);
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return new Promise<boolean>((resolve) => { pending.current = resolve; });
  }, []);
  const dialog = <ConfirmationPopoverLayer><AlertDialog open={Boolean(options)} onOpenChange={(open) => { if (!open) finish(false); }}>
    <AlertDialogContent data-overlay-layer="confirmation" onCloseAutoFocus={(event) => {
      // A parent may close after acceptance; do not let this alert then focus body.
      event.preventDefault();
      if (returnFocus.current?.isConnected && !returnFocus.current.closest("[inert]")) returnFocus.current.focus();
    }}>
      <AlertDialogHeader><AlertDialogTitle>{options?.title}</AlertDialogTitle><AlertDialogDescription>{options?.description}</AlertDialogDescription></AlertDialogHeader>
      <div className="eflow-confirmation-body eflow-scroll-region">
        {options?.impact}
        {Boolean(options?.blockers?.length) && <FeedbackState tone="warning" title="Resolve these before continuing"><ul>{options?.blockers?.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></FeedbackState>}
        {options?.confirmationText && <FormField label={`Type ${options.confirmationText} to confirm`}><TextInput value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></FormField>}
      </div>
      <AlertDialogFooter><AlertDialogCancel onClick={() => finish(false)}>{options?.cancelLabel || 'Cancel'}</AlertDialogCancel><Button type="button" disabled={Boolean(options?.blockers?.length) || Boolean(options?.confirmationText && typed !== options.confirmationText)} variant={options?.danger ? "destructive" : "default"} onClick={() => finish(true)}>{options?.actionLabel || "Confirm"}</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog></ConfirmationPopoverLayer>;
  return { confirm, dialog, cancel: () => finish(false) };
}
