import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatMoneyInput, moneyInputError, parseMoneyInput } from '../../shared/moneyInput';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number | string; onValueChange: (raw: string) => void;
};
/** Grouped display, ungrouped callback; financial API payloads stay numeric. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput({ value, onValueChange, min = 0, max = 90_000_000_000, step = '0.01', onBlur, onKeyDown, ...props }, forwardedRef) {
  const [raw, setRaw] = useState(() => String(value ?? ''));
  const input = useRef<HTMLInputElement | null>(null), caret = useRef<number | null>(null);
  useEffect(() => { if (value === '' && raw !== '' || Number(value) !== Number(raw)) setRaw(String(value)); }, [value]);
  const error = moneyInputError(raw, Number(min), Number(max));
  useLayoutEffect(() => {
    input.current?.setCustomValidity(error);
    if (caret.current !== null && document.activeElement === input.current) {
      const display = formatMoneyInput(raw); let count = 0, position = 0;
      while (position < display.length && count < caret.current) { if (display[position] !== ',') count++; position++; }
      input.current?.setSelectionRange(position, position); caret.current = null;
    }
  }, [raw, error]);
  const change = (next: string) => { setRaw(next); onValueChange(next); };
  return <input {...props} type="text" inputMode="decimal" role="spinbutton" aria-valuemin={Number(min)} aria-valuemax={Number(max)} aria-valuenow={raw && Number.isFinite(Number(raw)) ? Number(raw) : undefined} aria-invalid={props['aria-invalid'] || !!error || undefined}
    ref={node => { input.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }} value={formatMoneyInput(raw)}
    onChange={event => {
      const typed = event.target.value, next = parseMoneyInput(typed); if (next === null) return;
      const ungrouped = typed.replace(/[,₱\s]/g, '');
      caret.current = Math.max(0, typed.slice(0, event.target.selectionStart ?? typed.length).replace(/[,₱\s]/g, '').length + next.length - ungrouped.length);
      change(next);
    }}
    onBlur={event => { if (error) event.target.reportValidity(); onBlur?.(event); }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || props.readOnly || props.disabled) return;
      const field = event.currentTarget, position = field.selectionStart;
      if (position !== null && position === field.selectionEnd && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // A grouping comma is display-only. Delete the adjacent digit rather
        // than restoring the comma and leaving the cursor stuck in place.
        const backward = event.key === 'Backspace' && field.value[position - 1] === ',';
        const forward = event.key === 'Delete' && field.value[position] === ',';
        if (backward || forward) {
          event.preventDefault();
          const index = field.value.slice(0, position).replace(/,/g, '').length - (backward ? 1 : 0);
          const edited = raw.slice(0, index) + raw.slice(index + 1), next = parseMoneyInput(edited) || '';
          caret.current = Math.max(0, index + next.length - edited.length);
          change(next);
          return;
        }
      }
      if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); const increment = Number(step) || .01;
        change(String(Math.min(Number(max), Math.max(Number(min), Math.round((Number(raw || 0) + (event.key === 'ArrowUp' ? increment : -increment)) * 100) / 100))));
      }
    }}/>
});
