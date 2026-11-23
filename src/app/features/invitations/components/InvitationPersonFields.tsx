import type { ReactNode } from 'react';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { SkillTagSelector } from '../../../components/ui/SkillTagSelector';
import { INPUT_LIMITS } from '../../../shared/inputLimits';

/** Shared content for Office invitations. */
export function InvitationPersonFields({
  id,
  index,
  email,
  emailError,
  required = true,
  skills = [],
  availableSkills = [],
  loadingSkills = false,
  disabled,
  compact = false,
  children,
  onEmail,
  onEmailBlur,
  onSkills,
}: {
  id: string;
  index: number;
  email: string;
  emailError?: string;
  required?: boolean;
  skills?: string[];
  availableSkills?: readonly string[];
  loadingSkills?: boolean;
  disabled: boolean;
  compact?: boolean;
  children?: ReactNode;
  onEmail: (value: string) => void;
  onEmailBlur?: () => void;
  onSkills?: (skills: string[]) => void;
  file?: File;
  onFile?: (value: File | undefined) => void;
  onError?: (message: string) => void;
}) {
  const emailLabel = (
    <label
      className={compact ? 'mb-1 block text-xs font-medium text-foreground' : undefined}
      htmlFor={`invite-email-${id}`}
    >
      Email address {index + 1}
      {required && (
        <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
          {' '}*
        </span>
      )}
    </label>
  );
  const emailInput = (
    <BoundedTextInput
      id={`invite-email-${id}`}
      type="email"
      autoComplete="email"
      placeholder="Add email here"
      value={email}
      maxLength={INPUT_LIMITS.EMAIL}
      aria-required={required || undefined}
      error={emailError || undefined}
      onBlur={onEmailBlur}
      onChange={(e) => onEmail(e.target.value)}
      className="!w-full"
    />
  );
  const showSkillSelector =
    Boolean(onSkills) &&
    (availableSkills.length > 0 || loadingSkills || skills.length > 0);

  return (
    <fieldset className="eflow-invite-row" disabled={disabled}>
      <legend className={compact ? 'sr-only' : undefined}>Person {index + 1}</legend>
      {compact ? (
        <div>
          {emailLabel}
          <div className="eflow-invite-inputs !items-start">
            <div className="min-w-0 flex-1">{emailInput}</div>
            {children}
          </div>
        </div>
      ) : (
        <>
          {emailLabel}
          {emailInput}
          {children}
        </>
      )}
      {showSkillSelector && onSkills && (
        <div className="mt-2.5">
          <SkillTagSelector
            availableTags={availableSkills}
            loading={loadingSkills}
            selected={skills}
            disabled={disabled}
            title="Skills (optional)"
            description="Tap skill tags to pre-select skills for this member."
            emptyMessage="No skill tags added yet."
            onChange={onSkills}
          />
        </div>
      )}
    </fieldset>
  );
}
