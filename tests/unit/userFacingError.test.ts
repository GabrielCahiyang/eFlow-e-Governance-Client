import { describe, expect, it } from 'vitest';
import {
  PROFILE_VERIFICATION_MESSAGE,
  SESSION_REFRESH_MESSAGE,
  isSessionError,
  userFacingError,
} from '../../src/app/shared/userFacingError';

describe('user-facing authentication errors', () => {
  it('never exposes the raw expired-session response', () => {
    expect(userFacingError(new Error('Invalid or expired Supabase session.'), 'fallback'))
      .toBe(SESSION_REFRESH_MESSAGE);
  });

  it('recognizes the sanitized session response without classifying a read denial as session recovery', () => {
    expect(isSessionError(SESSION_REFRESH_MESSAGE)).toBe(true);
    expect(isSessionError('Office read denied')).toBe(false);
  });

  it('maps the missing-profile response to a recovery message', () => {
    expect(userFacingError(new Error('The authenticated user does not have an eFlow profile.'), 'fallback'))
      .toBe(PROFILE_VERIFICATION_MESSAGE);
  });

  it('keeps useful business errors', () => {
    expect(userFacingError(new Error('Only the Lead Office Head can manage project invitations.'), 'fallback'))
      .toBe('Only the Lead Office Head can manage project invitations.');
  });
});
