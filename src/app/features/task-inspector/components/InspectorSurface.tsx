import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Modal } from '../../../components/ui/Modal';
import './taskPage.css';

export type InspectorPresentation = 'drawer' | 'page' | 'dialog';

export interface InspectorSurfaceProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  ariaDescriptionId?: string;
  children: ReactNode;
  className?: string;
  layer?: number;
  preventClose?: boolean;
  returnFocus?: HTMLElement | null;
  onReturnFocus?: () => void;
  presentation?: InspectorPresentation;
}

/** The page variant stays inside the application shell; all overlay variants open in the centered eFlow dialog. */
export function InspectorSurface({
  presentation = 'dialog',
  ...props
}: InspectorSurfaceProps) {
  const page = useRef<HTMLElement>(null);
  const returnTarget = useRef({ element: props.returnFocus, restore: props.onReturnFocus });
  returnTarget.current = { element: props.returnFocus, restore: props.onReturnFocus };

  useLayoutEffect(() => {
    if (!props.open) return;
    if (presentation === 'page') page.current?.focus();
    return () => {
      const target = returnTarget.current;
      requestAnimationFrame(() => {
        if (target.element?.isConnected && !target.element.closest('[hidden],[inert]')) {
          target.element.focus();
        } else {
          target.restore?.();
        }
      });
    };
  }, [presentation, props.open]);

  if (presentation !== 'page') {
    return (
      <Modal
        isOpen={props.open}
        ariaLabel={props.ariaLabel}
        preventClose={props.preventClose}
        onClose={props.onClose}
        width="max-w-6xl"
        className="task-dialog-modal"
        bodyClassName="task-dialog-modal__body"
      >
        <div className="task-dialog" aria-label={props.ariaLabel}>
          {props.children}
        </div>
      </Modal>
    );
  }
  if (!props.open) return null;
  return (
    <section ref={page} tabIndex={-1} className="task-page" aria-label={props.ariaLabel}>
      {props.children}
    </section>
  );
}
