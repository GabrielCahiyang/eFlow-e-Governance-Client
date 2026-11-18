import { describe, expect, it } from 'vitest';
import { readableUiError, userFacingError } from '../../src/app/shared/userFacingError';

const save = "We couldn't confirm this Office change. Check the Office list before trying again.";
describe('readable errors at UI boundaries', () => {
  it.each([
    { code: 'PGRST202', message: 'Could not find function eflow_command in the schema cache.' },
    { code: '42883', message: 'function private_save does not exist' },
    { message: 'Apply migration 20261117000000_setup.sql, then retry the RPC.' },
  ])('replaces setup diagnostics without asking an ordinary user to run database work', reason => {
    const result = readableUiError(reason, save);
    expect(result).toContain(save);
    expect(result).toContain('administrator');
    expect(result).not.toMatch(/PGRST|private_save|schema cache|20261117|SQL|RPC/);
  });
  it('explains denied database access without granting or suggesting a bypass', () => {
    const result = readableUiError({ code: '42501', message: 'new row violates row-level security policy for task_members' }, save);
    expect(result).toContain('does not have permission');
    expect(result).not.toContain('task_members');
  });
  it('distinguishes a failed read from an uncertain write after connection loss', () => {
    const reason = new TypeError('Failed to fetch');
    expect(readableUiError(reason, 'Could not load projects.', 'read')).toContain('reload this view');
    expect(readableUiError(reason, save)).toContain("couldn't confirm the result");
    expect(readableUiError(reason, save)).toContain('current record before trying again');
    expect(readableUiError(new Error('upstream request timeout'), 'Could not load projects.', 'read')).not.toContain('upstream request timeout');
  });
  it('does not mistake a programming TypeError for a lost internet connection', () => {
    expect(readableUiError(new TypeError("Cannot read properties of undefined (reading 'id')"), save)).toBe(save);
  });
  it('preserves specific business rules and confirmed/uncertain outcomes', () => {
    for(const message of ['Receipt total exceeds the released cash.', 'Your change was saved, but the list could not reload.', 'The result is not confirmed. Check with Accounting before deciding.']) {
      expect(readableUiError(new Error(message), save)).toBe(message);
    }
    expect(readableUiError(new Error('RPC outcome unconfirmed; check receipt_id'), save)).toBe(save);
  });
  it('uses contextual fallback copy for empty or vague errors', () => {
    expect(readableUiError(null, save)).toBe(save);
    expect(readableUiError(new Error('Something went wrong.'), save)).toBe(save);
    expect(readableUiError(new Error('Internal server error'), save)).toBe(save);
  });
  it('explains sign-in recovery and preserves the existing service-facing formatter', () => {
    expect(readableUiError({ status: 401, message: 'JWT expired' }, save)).toContain('check your sign-in');
    const raw = new Error('function legacy_save does not exist');
    expect(userFacingError(raw, save)).toBe(raw.message);
    expect(raw.message).toBe('function legacy_save does not exist');
  });
});
