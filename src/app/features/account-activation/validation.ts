import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STRONG_PASSWORD_DEFAULT_LENGTH,
  evaluatePasswordRequirements,
  generateStrongPassword,
  isStrongPassword,
  passwordStrengthSummary,
  validateNewPassword,
  validatePasswordConfirmation,
  type PasswordRequirements,
} from '../../shared/passwordPolicy';

export const MAX_ACCOUNT_SKILLS = 100;
export const MAX_ACCOUNT_SKILL_LENGTH = 100;
export const ACTIVATION_NAME_MIN_LENGTH = 2;
export const ACTIVATION_NAME_MAX_LENGTH = 160;
export const ACTIVATION_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;
export const ACTIVATION_PASSWORD_MAX_LENGTH = PASSWORD_MAX_LENGTH;

export {
  STRONG_PASSWORD_DEFAULT_LENGTH,
  evaluatePasswordRequirements,
  generateStrongPassword,
  isStrongPassword as isStrongActivationPassword,
  passwordStrengthSummary,
  validateNewPassword as validateActivationPassword,
  validatePasswordConfirmation as validateActivationConfirmation,
  type PasswordRequirements,
};

const unsupported = /[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;

export interface ActivationFieldErrors {
  fullName?: string;
  password?: string;
  confirmation?: string;
}

export function accountSkillsError(skills: Record<string, boolean>) {
  if (Object.keys(skills).length > MAX_ACCOUNT_SKILLS) return 'Add up to 100 skills.';
  return Object.keys(skills).some(
    skill => !skill.trim() || skill.length > MAX_ACCOUNT_SKILL_LENGTH || unsupported.test(skill),
  )
    ? 'Each skill must contain 1–100 characters without hidden or control characters.'
    : '';
}

/** Validates the invitee's full name for account activation. */
export function validateActivationFullName(fullName: string): string | undefined {
  const cleaned = fullName.trim();
  if (!cleaned) return 'Enter your full name.';
  if (cleaned.length < ACTIVATION_NAME_MIN_LENGTH || cleaned.length > ACTIVATION_NAME_MAX_LENGTH) {
    return `Enter your full name (${ACTIVATION_NAME_MIN_LENGTH} to ${ACTIVATION_NAME_MAX_LENGTH} characters).`;
  }
  if (unsupported.test(cleaned)) {
    return 'Full name cannot contain hidden or control characters.';
  }
  return undefined;
}

/** Runs formal field validation across all required account activation inputs. */
export function validateActivationFields(input: {
  fullName: string;
  password: string;
  confirmation: string;
}): ActivationFieldErrors {
  const errors: ActivationFieldErrors = {};
  const fullNameError = validateActivationFullName(input.fullName);
  const passwordError = validateNewPassword(input.password);
  const confirmationError = validatePasswordConfirmation(input.password, input.confirmation);
  if (fullNameError) errors.fullName = fullNameError;
  if (passwordError) errors.password = passwordError;
  if (confirmationError) errors.confirmation = confirmationError;
  return errors;
}
