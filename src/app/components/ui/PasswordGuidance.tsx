import { Check, CheckCircle2, Circle, Copy, Sparkles, XCircle } from 'lucide-react';
import {
  PASSWORD_MIN_LENGTH,
  evaluatePasswordRequirements,
  passwordStrengthSummary,
} from '../../shared/passwordPolicy';
import './passwordGuidance.css';

function RequirementRow({
  met,
  invalid,
  label,
}: {
  met: boolean;
  invalid: boolean;
  label: string;
}) {
  return (
    <li data-met={met ? 'true' : 'false'} data-invalid={invalid ? 'true' : 'false'}>
      {met ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : invalid ? (
        <XCircle size={14} aria-hidden="true" />
      ) : (
        <Circle size={14} aria-hidden="true" />
      )}
      <span>{label}</span>
    </li>
  );
}

export interface PasswordGuidanceProps {
  password: string;
  showInvalidState: boolean;
  disabled?: boolean;
  suggestedActive?: boolean;
  copied?: boolean;
  onSuggest: () => void;
  onCopy?: () => void;
}

/** Live password requirements checklist, strength meter, and strong-password suggestion controls. */
export function PasswordGuidance({
  password,
  showInvalidState,
  disabled = false,
  suggestedActive = false,
  copied = false,
  onSuggest,
  onCopy,
}: PasswordGuidanceProps) {
  const requirements = evaluatePasswordRequirements(password);
  const strength = passwordStrengthSummary(password);
  const remaining = Math.max(0, PASSWORD_MIN_LENGTH - password.length);
  const lengthLabel =
    password.length > 0 && remaining > 0
      ? `At least ${PASSWORD_MIN_LENGTH} characters (${remaining} more needed)`
      : `At least ${PASSWORD_MIN_LENGTH} characters`;

  return (
    <div className="eflow-password-guidance">
      <div className="eflow-password-tools">
        <button
          type="button"
          className="eflow-password-tool-btn"
          disabled={disabled}
          onClick={onSuggest}
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Suggest strong password</span>
        </button>
        {suggestedActive && password && onCopy && (
          <button
            type="button"
            className="eflow-password-tool-btn eflow-password-tool-btn--secondary"
            disabled={disabled}
            onClick={onCopy}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            <span>{copied ? 'Copied' : 'Copy password'}</span>
          </button>
        )}
      </div>

      {suggestedActive && password && (
        <p className="eflow-password-suggested-note" role="status">
          Strong password suggested and applied. Copy and store it safely before continuing.
        </p>
      )}

      <div className="eflow-password-strength" aria-live="polite">
        <div className="eflow-password-strength-header">
          <span>Password requirements</span>
          {password && (
            <span
              className="eflow-password-strength-badge"
              data-level={strength.label.toLowerCase()}
            >
              {strength.label}
            </span>
          )}
        </div>
        <div className="eflow-password-strength-bars" aria-hidden="true">
          {[1, 2, 3, 4].map(segment => (
            <span
              key={segment}
              className="eflow-password-strength-bar"
              data-tone={strength.score >= segment ? strength.label.toLowerCase() : 'none'}
            />
          ))}
        </div>
        <ul className="eflow-password-checklist" aria-label="Password requirements">
          <RequirementRow
            met={requirements.length}
            invalid={showInvalidState && !requirements.length}
            label={lengthLabel}
          />
          <RequirementRow
            met={requirements.letter}
            invalid={showInvalidState && !requirements.letter}
            label="At least one letter (A–Z, a–z)"
          />
          <RequirementRow
            met={requirements.number}
            invalid={showInvalidState && !requirements.number}
            label="At least one number (0–9)"
          />
          <RequirementRow
            met={requirements.special}
            invalid={showInvalidState && !requirements.special}
            label="At least one special character (!@#$...)"
          />
        </ul>
      </div>
    </div>
  );
}
