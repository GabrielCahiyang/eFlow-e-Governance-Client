import { useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";

/**
 * Accessible shell for feature-owned dialog layouts. It keeps a feature's
 * visual composition while providing the shared Radix focus and dismissal
 * contract for every direct-overlay migration.
 */
export function FeatureDialog({
  open = true,
  onClose,
  title,
  description,
  children,
  contentClassName = "",
  overlayClassName = "",
  showCloseButton = true,
  preventClose = false,
}: {
  open?: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
  preventClose?: boolean;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const previouslyOpen = useRef(false);
  // Capture the opener before child autofocus effects can replace it.
  if (open && !previouslyOpen.current) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previouslyOpen.current = open;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !preventClose && onClose()}>
      <DialogContent
        aria-label={title}
        overlayClassName={overlayClassName}
        className={`flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden p-0 ${contentClassName}`}
        showCloseButton={showCloseButton && !preventClose}
        aria-busy={preventClose || undefined}
        onOpenAutoFocus={() => { if (!returnFocus.current?.isConnected) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocus.current?.isConnected && !returnFocus.current.closest("[inert]")) { returnFocus.current.focus(); }
        }}
        onEscapeKeyDown={(event) => { if (preventClose) event.preventDefault(); }}
        onInteractOutside={(event) => { if (preventClose) event.preventDefault(); }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description || `${title} dialog`}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
