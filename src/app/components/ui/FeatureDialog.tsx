import type { ReactNode } from "react";
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
  showCloseButton = true,
}: {
  open?: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        aria-label={title}
        className={`flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden p-0 ${contentClassName}`}
        showCloseButton={showCloseButton}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description || `${title} dialog`}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
