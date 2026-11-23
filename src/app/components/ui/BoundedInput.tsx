import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { FieldValidationTooltip } from './FieldValidationTooltip';
import './fieldValidation.css';

function counterLevel(length: number, max: number): 'normal' | 'warn' | 'max' {
  if (length >= max) return 'max';
  if (length >= Math.floor(max * 0.85)) return 'warn';
  return 'normal';
}

function useTransientNotice(durationMs = 2600) {
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'warning' } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
  }, []);

  const flash = (message: string, tone: 'error' | 'warning' = 'warning') => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    setNotice({ message, tone });
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setNotice(null);
    }, durationMs);
  };

  const clear = () => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    setNotice(null);
  };

  return { notice, flash, clear };
}

function isPrintableLimitHit(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, maxLength: number): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key.length !== 1) return false;
  const target = event.currentTarget;
  const selectionLength = Math.abs((target.selectionEnd ?? 0) - (target.selectionStart ?? 0));
  return target.value.length >= maxLength && selectionLength === 0;
}

function pasteWouldOverflow(event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>, maxLength: number): boolean {
  const pasted = event.clipboardData?.getData('text') ?? '';
  if (!pasted) return false;
  const target = event.currentTarget;
  const selectionLength = Math.abs((target.selectionEnd ?? 0) - (target.selectionStart ?? 0));
  return target.value.length - selectionLength + pasted.length > maxLength;
}

export interface BoundedTextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'maxLength'> {
  value: string;
  maxLength: number;
  error?: string;
  hint?: string;
  showCounter?: boolean;
  compact?: boolean;
}

/** Single-line text input with live bottom-right character counter and theme-matched limit/error tooltip. */
export const BoundedTextInput = forwardRef<HTMLInputElement, BoundedTextInputProps>(function BoundedTextInput(
  {
    value,
    maxLength,
    error,
    hint,
    showCounter = true,
    compact = false,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    className = '',
    ...props
  },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const { notice, flash } = useTransientNotice();
  const tooltipId = useId();
  const length = value.length;
  const level = counterLevel(length, maxLength);
  const activeMessage = notice?.message || (focused && error ? error : '');
  const activeTone: 'error' | 'warning' = notice ? notice.tone : 'error';
  const isInvalid = Boolean(error) || props['aria-invalid'] === true || props['aria-invalid'] === 'true';

  return (
    <div className="eflow-bounded-field">
      <input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        value={value}
        maxLength={maxLength}
        aria-invalid={isInvalid || undefined}
        aria-describedby={activeMessage ? tooltipId : props['aria-describedby']}
        className={`${className} ${isInvalid ? 'eflow-field-invalid' : ''}`.trim()}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && !props.readOnly && !props.disabled && isPrintableLimitHit(event, maxLength)) {
            flash(`Maximum ${maxLength.toLocaleString('en-US')} characters reached.`, 'warning');
          }
        }}
        onPaste={(event) => {
          onPaste?.(event);
          if (!event.defaultPrevented && !props.readOnly && !props.disabled && pasteWouldOverflow(event, maxLength)) {
            flash(`Pasted text trimmed to the ${maxLength.toLocaleString('en-US')}-character limit.`, 'warning');
          }
        }}
      />
      <FieldValidationTooltip
        id={tooltipId}
        anchorRef={inputRef}
        message={activeMessage}
        open={Boolean(activeMessage)}
        tone={activeTone}
      />
      {(showCounter || error || hint) && !compact && (
        <div className="eflow-bounded-meta">
          {(error || hint) && (
            <span className="eflow-bounded-meta__hint" data-tone={error ? 'error' : undefined}>
              {error || hint}
            </span>
          )}
          {showCounter && (
            <span
              className="eflow-bounded-counter"
              data-level={level}
              aria-live={level === 'max' ? 'polite' : undefined}
            >
              {length.toLocaleString('en-US')} / {maxLength.toLocaleString('en-US')}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export interface BoundedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'maxLength'> {
  value: string;
  maxLength: number;
  error?: string;
  hint?: string;
  showCounter?: boolean;
}

/** Multi-line textarea with embedded bottom-right live character counter and theme-matched limit/error tooltip. */
export const BoundedTextarea = forwardRef<HTMLTextAreaElement, BoundedTextareaProps>(function BoundedTextarea(
  {
    value,
    maxLength,
    error,
    hint,
    showCounter = true,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    className = '',
    ...props
  },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const { notice, flash } = useTransientNotice();
  const tooltipId = useId();
  const length = value.length;
  const level = counterLevel(length, maxLength);
  const activeMessage = notice?.message || (focused && error ? error : '');
  const activeTone: 'error' | 'warning' = notice ? notice.tone : 'error';
  const isInvalid = Boolean(error) || props['aria-invalid'] === true || props['aria-invalid'] === 'true';

  return (
    <div className="eflow-bounded-field">
      <div className="eflow-bounded-textarea-wrap">
        <textarea
          {...props}
          ref={(node) => {
            textareaRef.current = node;
            if (typeof forwardedRef === 'function') forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          value={value}
          maxLength={maxLength}
          aria-invalid={isInvalid || undefined}
          aria-describedby={activeMessage ? tooltipId : props['aria-describedby']}
          className={`${className} ${isInvalid ? 'eflow-field-invalid' : ''}`.trim()}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented && !props.readOnly && !props.disabled && isPrintableLimitHit(event, maxLength)) {
              flash(`Maximum ${maxLength.toLocaleString('en-US')} characters reached.`, 'warning');
            }
          }}
          onPaste={(event) => {
            onPaste?.(event);
            if (!event.defaultPrevented && !props.readOnly && !props.disabled && pasteWouldOverflow(event, maxLength)) {
              flash(`Pasted text trimmed to the ${maxLength.toLocaleString('en-US')}-character limit.`, 'warning');
            }
          }}
        />
        {showCounter && (
          <span
            className="eflow-bounded-textarea-counter"
            data-level={level}
            aria-live={level === 'max' ? 'polite' : undefined}
          >
            {length.toLocaleString('en-US')} / {maxLength.toLocaleString('en-US')}
          </span>
        )}
      </div>
      <FieldValidationTooltip
        id={tooltipId}
        anchorRef={textareaRef}
        message={activeMessage}
        open={Boolean(activeMessage)}
        tone={activeTone}
      />
      {(error || hint) && (
        <div className="eflow-bounded-meta">
          <span className="eflow-bounded-meta__hint" data-tone={error ? 'error' : undefined}>
            {error || hint}
          </span>
        </div>
      )}
    </div>
  );
});
