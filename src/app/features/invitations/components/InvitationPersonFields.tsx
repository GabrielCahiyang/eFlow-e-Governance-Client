import type { ReactNode } from 'react';
import { SkillTagSelector } from '../../../components/ui/SkillTagSelector';

/** Shared content for Office invitations. */
export function InvitationPersonFields({
  id,
  index,
  email,
  skills = [],
  availableSkills = [],
  loadingSkills = false,
  disabled,
  compact = false,
  children,
  onEmail,
  onSkills,
}: {
  id: string;
  index: number;
  email: string;
  skills?: string[];
  availableSkills?: readonly string[];
  loadingSkills?: boolean;
  disabled: boolean;
  compact?: boolean;
  children?: ReactNode;
  onEmail: (value: string) => void;
  onSkills?: (skills: string[]) => void;
  file?: File;
  onFile?: (value: File | undefined) => void;
  onError?: (message: string) => void;
}) {
  const content = (
    <>
      <label className={compact ? 'sr-only' : undefined} htmlFor={`invite-email-${id}`}>
        Email address {index + 1}
      </label>
      <input
        id={`invite-email-${id}`}
        type="email"
        autoComplete="email"
        placeholder="Add email here"
        value={email}
        maxLength={254}
        onChange={(e) => onEmail(e.target.value)}
      />
      {children}
    </>
  );
  const showSkillSelector =
    Boolean(onSkills) &&
    (availableSkills.length > 0 || loadingSkills || skills.length > 0);

  return (
    <fieldset className="eflow-invite-row" disabled={disabled}>
      <legend className={compact ? 'sr-only' : undefined}>Person {index + 1}</legend>
      {compact ? <div className="eflow-invite-inputs">{content}</div> : content}
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
