import { useCallback, useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./alert-dialog";

interface ConfirmationOptions { title: string; description: string; actionLabel?: string; danger?: boolean }

/** Resolve confirmation before starting a mutation; cancellation has no side effects. */
export function useConfirmation() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const finish = useCallback((accepted: boolean) => {
    pending.current?.(accepted); pending.current = null; setOptions(null);
  }, []);
  useEffect(() => () => { pending.current?.(false); }, []);
  const confirm = useCallback((next: ConfirmationOptions) => {
    pending.current?.(false); setOptions(next);
    return new Promise<boolean>((resolve) => { pending.current = resolve; });
  }, []);
  const dialog = <AlertDialog open={Boolean(options)} onOpenChange={(open) => { if (!open) finish(false); }}>
    <AlertDialogContent className="z-[350]" overlayClassName="z-[349]">
      <AlertDialogHeader><AlertDialogTitle>{options?.title}</AlertDialogTitle><AlertDialogDescription>{options?.description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel onClick={() => finish(false)}>Cancel</AlertDialogCancel><button type="button" onClick={() => finish(true)} className={`rounded-md px-4 py-2 text-sm font-medium text-white ${options?.danger ? "bg-red-600" : "bg-primary"}`}>{options?.actionLabel || "Confirm"}</button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { confirm, dialog };
}
