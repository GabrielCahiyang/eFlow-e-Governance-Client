export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const STRONG_PASSWORD_DEFAULT_LENGTH = 16;

const UNSUPPORTED_CHARS = /[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
const HAS_LETTER = /[A-Za-z]/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /[0-9]/;
const HAS_SPECIAL = /[^A-Za-z0-9\s]/;

const UPPERCASE_POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE_POOL = 'abcdefghijkmnopqrstuvwxyz';
const NUMBER_POOL = '23456789';
const SPECIAL_POOL = '!@#$%^&*-_=+?';
const COMBINED_POOL = UPPERCASE_POOL + LOWERCASE_POOL + NUMBER_POOL + SPECIAL_POOL;

export interface PasswordRequirements {
  length: boolean;
  letter: boolean;
  number: boolean;
  special: boolean;
  noControlChars: boolean;
}

/** Evaluates each industry-standard password requirement independently. */
export function evaluatePasswordRequirements(password: string): PasswordRequirements {
  return {
    length:
      password.length >= PASSWORD_MIN_LENGTH &&
      password.length <= PASSWORD_MAX_LENGTH,
    letter: HAS_LETTER.test(password),
    number: HAS_NUMBER.test(password),
    special: HAS_SPECIAL.test(password),
    noControlChars: !UNSUPPORTED_CHARS.test(password),
  };
}

/** Returns true when a password meets length and letter/number/special-character rules. */
export function isStrongPassword(password: string): boolean {
  const req = evaluatePasswordRequirements(password);
  return req.length && req.letter && req.number && req.special && req.noControlChars;
}

/** Computes a user-facing password strength level for live feedback. */
export function passwordStrengthSummary(password: string): {
  score: number;
  label: 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong';
} {
  if (!password) return { score: 0, label: 'Empty' };
  const req = evaluatePasswordRequirements(password);
  const mandatoryCount = [req.length, req.letter, req.number, req.special].filter(Boolean).length;

  if (!isStrongPassword(password)) {
    return mandatoryCount >= 3 ? { score: 2, label: 'Fair' } : { score: 1, label: 'Weak' };
  }

  const hasMixedCase = HAS_UPPERCASE.test(password) && HAS_LOWERCASE.test(password);
  if (hasMixedCase && password.length >= 16) {
    return { score: 4, label: 'Strong' };
  }
  return { score: 3, label: 'Good' };
}

/** Validates a new password against minimum length and character-class rules. */
export function validateNewPassword(password: string): string | undefined {
  if (!password) return 'Enter a password.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  const req = evaluatePasswordRequirements(password);
  if (!req.noControlChars) {
    return 'Password cannot contain hidden or control characters.';
  }
  const missing: string[] = [];
  if (!req.letter) missing.push('a letter');
  if (!req.number) missing.push('a number');
  if (!req.special) missing.push('a special character');
  if (missing.length > 0) {
    return `Password must contain a letter, a number, and a special character (missing ${missing.join(', ')}).`;
  }
  return undefined;
}

/** Validates that password confirmation is present and matches the new password. */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (!confirmation) return 'Confirm your password.';
  if (password !== confirmation) return 'The passwords do not match.';
  return undefined;
}

function secureRandomIndex(max: number): number {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi?.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buffer = new Uint32Array(1);
    while (true) {
      cryptoApi.getRandomValues(buffer);
      if (buffer[0] < limit) return buffer[0] % max;
    }
  }
  return Math.floor(Math.random() * max);
}

/** Generates a strong random password guaranteed to contain letters, numbers, and special characters. */
export function generateStrongPassword(length = STRONG_PASSWORD_DEFAULT_LENGTH): string {
  const targetLength = Math.max(
    PASSWORD_MIN_LENGTH,
    Math.min(PASSWORD_MAX_LENGTH, length),
  );
  const chars = [
    UPPERCASE_POOL[secureRandomIndex(UPPERCASE_POOL.length)],
    LOWERCASE_POOL[secureRandomIndex(LOWERCASE_POOL.length)],
    NUMBER_POOL[secureRandomIndex(NUMBER_POOL.length)],
    SPECIAL_POOL[secureRandomIndex(SPECIAL_POOL.length)],
  ];
  while (chars.length < targetLength) {
    chars.push(COMBINED_POOL[secureRandomIndex(COMBINED_POOL.length)]);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureRandomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
