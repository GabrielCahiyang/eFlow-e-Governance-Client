import { useId, type ReactNode } from "react";
import {
  Button,
  Modal as VibeModal,
  ModalBasicLayout,
  ModalContent,
  ModalHeader,
} from "@vibe/core";

interface ModalProps {
  isOpen: boolean;
  preventClose?: boolean;
  onClose: () => void;
  /** Optional title. The child content may provide its own branded header. */
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  className?: string;
  bodyClassName?: string;
  /** Retained for call-site compatibility; applied to the Vibe modal shell. */
  overlayClassName?: string;
}

function modalSizeForWidth(width: string): "small" | "medium" | "large" {
  if (width.includes("6xl") || width.includes("5xl") || width.includes("4xl")) return "large";
  if (width.includes("3xl") || width.includes("2xl") || width.includes("xl")) return "medium";
  return "small";
}

/**
 * Compatibility adapter around Vibe's accessible modal foundation.
 * Existing feature call sites keep their public API while gaining focus trapping,
 * focus restoration, Escape/backdrop handling, and reduced-motion-aware transitions.
 */
export function Modal({
  isOpen,
  preventClose = false,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
  width = "max-w-lg",
  className = "",
  bodyClassName = "",
  overlayClassName = "",
}: ModalProps) {
  const generatedId = useId().replace(/:/g, "");
  const modalId = `eflow-modal-${generatedId}`;
  const accessibleTitle = title || ariaLabel || "Dialog";
  const modalLayer = typeof document === "undefined" ? 300 : Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--eflow-layer-modal"), 10) || 300;

  return (
    <VibeModal
      closeButtonAriaLabel="Close dialog"
      id={modalId}
      onClose={() => { if (!preventClose && !document.querySelector("[data-slot='alert-dialog-content']")) onClose(); }}
      show={isOpen}
      alertModal={preventClose}
      allowFocusEscapeTo={["[data-slot='alert-dialog-content']", "[data-slot='select-content']", "[data-slot='popover-content']", "[data-slot='dropdown-menu-content']"]}
      size={modalSizeForWidth(width)}
      className={`eflow-responsive-modal ${preventClose ? "eflow-modal-locked" : ""} ${overlayClassName}`}
      useFixedPosition
      zIndex={modalLayer}
    >
      <ModalBasicLayout className={`eflow-vibe-modal-layout ${className}`}>
        <ModalHeader title={accessibleTitle} />
        <ModalContent className={`eflow-vibe-modal-content ${bodyClassName}`}>
          {children}
        </ModalContent>
      </ModalBasicLayout>

      {footer && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
          {footer}
        </div>
      )}
    </VibeModal>
  );
}

export function ModalButton({
  children,
  variant = "default",
  onClick,
  disabled,
  pending = false,
  type = "button",
}: {
  children: ReactNode;
  variant?: "default" | "primary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      loading={pending}
      aria-label={pending && typeof children === "string" ? children : undefined}
      kind={variant === "default" ? "secondary" : "primary"}
      color={variant === "danger" ? "negative" : "primary"}
      size="medium"
    >
      {children}
    </Button>
  );
}
