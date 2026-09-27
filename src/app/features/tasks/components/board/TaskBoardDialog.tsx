import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../../../components/ui/dialog";

interface TaskBoardDialogProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  onOpenAutoFocus?: (event: Event) => void;
}

/**
 * Shared task-board overlay shell. It preserves each dialog's workflow while
 * applying the Figma modal contract: accessible focus handling, 640px desktop
 * maximum, full-screen mobile, and persistent header/action regions.
 */
export function TaskBoardDialog({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  maxWidthClassName = "max-w-[640px]",
  onOpenAutoFocus,
}: TaskBoardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className={`flex max-h-[calc(100dvh-2rem)] min-h-0 ${maxWidthClassName} flex-col gap-0 overflow-hidden p-0 max-sm:max-h-none`}
        onOpenAutoFocus={onOpenAutoFocus}
      >
        <header className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
          <DialogTitle className="mt-1 text-[20px] leading-[26px]">{title}</DialogTitle>
          <DialogDescription className={description ? "mt-1" : "sr-only"}>
            {description || `${title} dialog`}
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-border px-5 py-4">
            {footer}
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
