import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { diffCentavos, exceedsCentavos, formatPeso } from '../../shared/currency';
import {
  formatMoneyInput,
  moneyInputError,
  moneyMaxFormattedLength,
  moneyMaxIntegerDigits,
  moneyRejectionMessage,
  parseMoneyInput,
  parseMoneyInputDetailed,
} from '../../shared/moneyInput';
import { FieldValidationTooltip } from './FieldValidationTooltip';
import './fieldValidation.css';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number | string;
  onValueChange: (raw: string) => void;
  /** Dynamic spendable ceiling (e.g., available source balance). Flags over-budget immediately with an anchored tooltip. */
  availableMax?: number;
  /** External field-level validation message anchored to this input. */
  externalError?: string;
  /** Shows a crisp bottom-right ceiling hint (`Max: ₱...`) when `availableMax` is provided. */
  showCeilingHint?: boolean;
};

/** Grouped display (comma every 3 digits), ungrouped callback; financial API payloads stay numeric. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  {
    value,
    onValueChange,
    min = 0,
    max = 90_000_000_000,
    availableMax,
    externalError,
    showCeilingHint = false,
    step = '0.01',
    maxLength,
    onBlur,
    onFocus,
    onKeyDown,
    onMouseEnter,
    onMouseLeave,
    ...props
  },
  forwardedRef,
) {
  const numericMin = Number(min);
  const numericMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 90_000_000_000;
  const maxIntDigits = moneyMaxIntegerDigits(numericMax);
  const effectiveMaxLength = maxLength ?? moneyMaxFormattedLength(numericMax);
  const [raw, setRaw] = useState(() => String(value ?? ''));
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [transientMessage, setTransientMessage] = useState('');
  const transientTimer = useRef<number | undefined>(undefined);
  const input = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if ((value === '' && raw !== '') || Number(value) !== Number(raw)) setRaw(String(value));
  }, [value]);

  useEffect(() => () => {
    if (transientTimer.current !== undefined) window.clearTimeout(transientTimer.current);
  }, []);

  const flashNotice = (message: string) => {
    if (transientTimer.current !== undefined) window.clearTimeout(transientTimer.current);
    setTransientMessage(message);
    transientTimer.current = window.setTimeout(() => {
      transientTimer.current = undefined;
      setTransientMessage('');
    }, 2600);
  };

  const rangeError = moneyInputError(raw, numericMin, numericMax);
  const numericValue = raw && Number.isFinite(Number(raw)) ? Number(raw) : NaN;
  const hasAvailableMax = availableMax !== undefined && Number.isFinite(availableMax) && availableMax >= 0;
  const overAvailable = hasAvailableMax && Number.isFinite(numericValue) && exceedsCentavos(numericValue, availableMax);
  const availableError = overAvailable
    ? `Exceeds available ${formatPeso(availableMax)} — reduce by ${formatPeso(diffCentavos(numericValue, availableMax))}.`
    : '';
  const fieldError = externalError || availableError || rangeError;
  const isInvalid = Boolean(props['aria-invalid']) || Boolean(fieldError);

  useLayoutEffect(() => {
    input.current?.setCustomValidity(fieldError);
    if (caret.current !== null && document.activeElement === input.current) {
      const display = formatMoneyInput(raw);
      let count = 0;
      let position = 0;
      while (position < display.length && count < caret.current) {
        if (display[position] !== ',') count++;
        position++;
      }
      input.current?.setSelectionRange(position, position);
      caret.current = null;
    }
  }, [raw, fieldError]);

  const change = (next: string) => {
    setRaw(next);
    onValueChange(next);
  };

  const activeTooltipMessage = transientMessage || (fieldError && (focused || hovered) ? fieldError : '');
  const activeTooltipTone: 'error' | 'warning' = transientMessage && !fieldError ? 'warning' : 'error';
  const mergedClassName = [props.className, 'tabular-nums', isInvalid ? 'eflow-field-invalid' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="eflow-money-wrap">
      <input
        {...props}
        className={mergedClassName}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        maxLength={effectiveMaxLength}
        aria-valuemin={numericMin}
        aria-valuemax={hasAvailableMax ? Math.min(numericMax, availableMax) : numericMax}
        aria-valuenow={Number.isFinite(numericValue) ? numericValue : undefined}
        aria-invalid={isInvalid || undefined}
        aria-describedby={activeTooltipMessage ? tooltipId : props['aria-describedby']}
        ref={(node) => {
          input.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        value={formatMoneyInput(raw)}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onMouseEnter={(event) => {
          setHovered(true);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          onMouseLeave?.(event);
        }}
        onChange={(event) => {
          const typed = event.target.value;
          const parsed = parseMoneyInputDetailed(typed, maxIntDigits);
          if (parsed.value === null) {
            if (parsed.reason) flashNotice(moneyRejectionMessage(parsed.reason, numericMax));
            return;
          }
          if (transientMessage) setTransientMessage('');
          const next = parsed.value;
          const ungrouped = typed.replace(/[,₱\s]/g, '').replace(/^php/i, '');
          caret.current = Math.max(
            0,
            typed
              .slice(0, event.target.selectionStart ?? typed.length)
              .replace(/[,₱\s]/g, '')
              .replace(/^php/i, '').length +
              next.length -
              ungrouped.length,
          );
          change(next);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || props.readOnly || props.disabled) return;
          const field = event.currentTarget;
          const position = field.selectionStart;
          const selectionLength =
            position !== null && field.selectionEnd !== null ? Math.abs(field.selectionEnd - position) : 0;

          if (position !== null && position === field.selectionEnd && !event.ctrlKey && !event.metaKey && !event.altKey) {
            // A grouping comma is display-only. Delete the adjacent digit rather
            // than restoring the comma and leaving the cursor stuck in place.
            const backward = event.key === 'Backspace' && field.value[position - 1] === ',';
            const forward = event.key === 'Delete' && field.value[position] === ',';
            if (backward || forward) {
              event.preventDefault();
              const index = field.value.slice(0, position).replace(/,/g, '').length - (backward ? 1 : 0);
              const edited = raw.slice(0, index) + raw.slice(index + 1);
              const next = parseMoneyInput(edited, maxIntDigits) || '';
              caret.current = Math.max(0, index + next.length - edited.length);
              change(next);
              return;
            }
          }

          if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            const increment = Number(step) || 0.01;
            const upper = hasAvailableMax ? Math.min(numericMax, availableMax) : numericMax;
            change(
              String(
                Math.min(
                  upper,
                  Math.max(
                    numericMin,
                    Math.round((Number(raw || 0) + (event.key === 'ArrowUp' ? increment : -increment)) * 100) / 100,
                  ),
                ),
              ),
            );
            return;
          }

          // Guard invalid printable keystrokes immediately with a theme-matched tooltip pop-up.
          if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
            if (event.key === '-') {
              event.preventDefault();
              flashNotice(moneyRejectionMessage('negative'));
              return;
            }
            if (!/^[\d.,]$/.test(event.key)) {
              event.preventDefault();
              flashNotice(moneyRejectionMessage('non_numeric'));
              return;
            }
            if (event.key === '.') {
              const selectedText =
                position !== null && field.selectionEnd !== null ? field.value.slice(position, field.selectionEnd) : '';
              if (raw.includes('.') && !selectedText.includes('.')) {
                event.preventDefault();
                flashNotice('Only one decimal point is allowed.');
                return;
              }
            }
            if (/^\d$/.test(event.key) && selectionLength === 0 && position !== null) {
              const rawBeforeCaret = field.value.slice(0, position).replace(/,/g, '');
              const dotIndex = raw.indexOf('.');
              if (dotIndex !== -1 && rawBeforeCaret.length > dotIndex) {
                const decimals = raw.slice(dotIndex + 1);
                if (decimals.length >= 2) {
                  event.preventDefault();
                  flashNotice(moneyRejectionMessage('too_many_decimals'));
                  return;
                }
              } else {
                const intPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex);
                if (intPart.length >= maxIntDigits) {
                  event.preventDefault();
                  flashNotice(moneyRejectionMessage('max_digits', numericMax));
                  return;
                }
              }
            }
          }
        }}
      />
      <FieldValidationTooltip
        id={tooltipId}
        anchorRef={input}
        message={activeTooltipMessage}
        open={Boolean(activeTooltipMessage)}
        tone={activeTooltipTone}
      />
      {showCeilingHint && (hasAvailableMax || Boolean(externalError)) && (
        <span className="eflow-money-hint" data-over={overAvailable || Boolean(externalError) ? 'true' : undefined}>
          {overAvailable ? (
            <>
              <AlertCircle size={13} className="eflow-money-hint__icon" aria-hidden="true" />
              <span>
                Exceeds {formatPeso(availableMax!)} by {formatPeso(diffCentavos(numericValue, availableMax!))}
              </span>
            </>
          ) : externalError ? (
            <>
              <AlertCircle size={13} className="eflow-money-hint__icon" aria-hidden="true" />
              <span>{externalError}</span>
            </>
          ) : (
            <span>Max: {formatPeso(availableMax!)}</span>
          )}
        </span>
      )}
    </div>
  );
});
