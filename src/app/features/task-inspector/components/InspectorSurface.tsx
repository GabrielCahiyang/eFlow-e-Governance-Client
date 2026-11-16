import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { InspectorPanel } from '../../../shared/motion';
import './taskPage.css';

export type InspectorPresentation = 'drawer' | 'page' | 'dialog';

/** The page variant stays inside the application shell; the dialog variant opens as a centered eFlow modal. */
export function InspectorSurface({
  presentation = 'drawer',
  ...props
}: ComponentProps<typeof InspectorPanel> & { presentation?: InspectorPresentation }) {
  const page = useRef<HTMLElement>(null);
  const returnTarget = useRef({ element: props.returnFocus, restore: props.onReturnFocus });
  returnTarget.current = { element: props.returnFocus, restore: props.onReturnFocus };

  useLayoutEffect(() => {
    if (presentation === 'drawer' || !props.open) return;
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

  if (presentation === 'dialog') {
    return (
      <Modal
        isOpen={props.open}
        ariaLabel={props.ariaLabel}
        preventClose={props.preventClose}
        onClose={props.onClose}
        width="max-w-5xl"
        className="task-dialog-modal"
        bodyClassName="task-dialog-modal__body"
      >
        <div className="task-dialog" aria-label={props.ariaLabel}>
          {props.children}
        </div>
      </Modal>
    );
  }
  if (presentation !== 'page') return <InspectorPanel {...props} />;
  if (!props.open) return null;
  return <section ref={page} tabIndex={-1} className="task-page" aria-label={props.ariaLabel}>{props.children}</section>;
}
