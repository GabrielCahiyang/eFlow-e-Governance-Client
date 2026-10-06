import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { motionDuration, motionTransition } from "./motionTokens";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let openInspectorCount = 0;
let previousBodyOverflow = "";
let rootWasInert = false;
let previousRootAriaHidden: string | null = null;
const inspectorStack: HTMLElement[] = [];

function lockApplication() {
  if (openInspectorCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = document.getElementById("root");
    if (root) {
      rootWasInert = Boolean(root.inert);
      previousRootAriaHidden = root.getAttribute("aria-hidden");
      root.inert = true;
      root.setAttribute("aria-hidden", "true");
    }
  }
  openInspectorCount += 1;
}

function unlockApplication() {
  openInspectorCount = Math.max(0, openInspectorCount - 1);
  if (openInspectorCount !== 0) return;

  document.body.style.overflow = previousBodyOverflow;
  const root = document.getElementById("root");
  if (!root) return;
  root.inert = rootWasInert;
  if (previousRootAriaHidden === null) root.removeAttribute("aria-hidden");
  else root.setAttribute("aria-hidden", previousRootAriaHidden);
}

export function InspectorPanel({
  open,
  onClose,
  ariaLabel,
  children,
  className = "",
  layer = 50,
  preventClose = false,
  returnFocus,
  onReturnFocus,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  layer?: number;
  preventClose?: boolean;
  returnFocus?: HTMLElement | null;
  onReturnFocus?: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocus = useRef(onReturnFocus); restoreFocus.current = onReturnFocus;
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = returnFocus || (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
    lockApplication();
    const panel = panelRef.current;
    if (panel) { panel.inert = false; panel.removeAttribute("aria-hidden"); inspectorStack.push(panel); }
    const focusFrame = window.requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable || panelRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (panel) {
        // Exit animation keeps the node connected; it must no longer receive focus.
        panel.inert = true;
        panel.setAttribute("aria-hidden", "true");
        const index = inspectorStack.indexOf(panel);
        if (index !== -1) inspectorStack.splice(index, 1);
      }
      unlockApplication();
      const target = returnFocusRef.current;
      // Radix nested scopes finish their unmount cleanup before focus returns.
      window.requestAnimationFrame(() => {
        if (target?.isConnected && !target.closest("[inert]")) target.focus();
        else restoreFocus.current?.();
      });
    };
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // React portals bubble through their owner; nested pickers/dialogs own their keys.
    if (event.defaultPrevented || !event.currentTarget.contains(event.target as Node) || inspectorStack[inspectorStack.length - 1] !== panelRef.current) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!preventClose) onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [],
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <>
          <m.div
            key="inspector-overlay"
            data-testid="inspector-backdrop"
            aria-hidden="true"
            className="fixed inset-0 bg-neutral-950/25 backdrop-blur-[1px]"
            style={{ zIndex: `calc(var(--eflow-layer-inspector, 200) + ${layer - 50})`, background: "var(--eflow-backdrop)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionDuration.productiveLong }}
            onClick={() => { if (!preventClose) onClose(); }}
          />
          <m.aside
            key="inspector-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            className={`eflow-inspector fixed bottom-0 right-0 top-0 flex flex-col border-l outline-none ${className}`}
            style={{ zIndex: `calc(var(--eflow-layer-inspector, 200) + ${layer - 49})` }}
            aria-busy={preventClose || undefined}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={motionTransition.inspector}
            onKeyDown={handleKeyDown}
          >
            {children}
          </m.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
