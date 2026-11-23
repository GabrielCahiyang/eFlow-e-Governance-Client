import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import './fieldValidation.css';

export interface FieldValidationTooltipProps {
  id?: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  message?: string;
  open: boolean;
  tone?: 'error' | 'warning';
}

interface TooltipCoords {
  top: number;
  left: number;
  caretLeft: number;
  placement: 'top' | 'bottom';
}

const GAP = 9;
const VIEWPORT_MARGIN = 12;

export function FieldValidationTooltip({
  id,
  anchorRef,
  message,
  open,
  tone = 'error',
}: FieldValidationTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);

  useLayoutEffect(() => {
    if (!open || !message) {
      setCoords(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        // Fallback for non-layout JSDOM environments so tooltip still renders for tests & AT.
        setCoords({ top: 0, left: 0, caretLeft: 16, placement: 'top' });
        return;
      }
      const tip = tooltipRef.current;
      const tipWidth = tip?.offsetWidth || Math.min(320, Math.max(200, rect.width));
      const tipHeight = tip?.offsetHeight || 40;
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;

      const preferTop = rect.top - tipHeight - GAP >= VIEWPORT_MARGIN;
      const placement: 'top' | 'bottom' = preferTop
        ? 'top'
        : rect.bottom + tipHeight + GAP <= vh - VIEWPORT_MARGIN
          ? 'bottom'
          : 'top';

      const rawLeft = rect.left;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rawLeft, vw - tipWidth - VIEWPORT_MARGIN));
      const top = placement === 'top' ? Math.max(VIEWPORT_MARGIN, rect.top - tipHeight - GAP) : rect.bottom + GAP;
      const anchorCenter = rect.left + Math.min(rect.width / 2, 42);
      const caretLeft = Math.max(14, Math.min(tipWidth - 22, anchorCenter - left - 4));

      setCoords({ top, left, caretLeft, placement });
    };

    update();
    const raf = window.requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, message, anchorRef]);

  if (!open || !message) return null;

  const Icon = tone === 'warning' ? AlertTriangle : AlertCircle;
  const node = (
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="eflow-validation-tooltip"
      data-tone={tone}
      data-placement={coords?.placement ?? 'top'}
      style={
        coords
          ? { top: `${coords.top}px`, left: `${coords.left}px` }
          : { top: '-9999px', left: '-9999px' }
      }
    >
      <Icon size={14} className="eflow-validation-tooltip__icon" aria-hidden="true" />
      <span>{message}</span>
      <span
        className="eflow-validation-tooltip__caret"
        aria-hidden="true"
        style={{ left: `${coords?.caretLeft ?? 16}px` }}
      />
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(node, document.body);
  }
  return node;
}
