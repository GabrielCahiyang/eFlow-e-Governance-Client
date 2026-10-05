import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readOnboarding, saveOnboarding } from '../../src/app/features/onboarding/services/onboardingService';
import { phase2Request } from '../../src/app/shared/phase2Api';

vi.mock('../../src/app/shared/phase2Api', () => ({
  phase2Request: vi.fn(),
  jsonRequest: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
}));

describe('Getting Started response boundary', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects an unrelated success response before it reaches the workspace', async () => {
    vi.mocked(phase2Request).mockResolvedValue({ success: true });
    await expect(readOnboarding()).rejects.toThrow('Getting Started could not be loaded');
    await expect(saveOnboarding({ status: 'dismissed' })).rejects.toThrow('Getting Started could not be loaded');
  });
  it('accepts a valid record with an empty optional checklist', async () => {
    const record = { user_id: 'member', tour_key: 'member', tour_version: 1, status: 'not_started', state: {} };
    vi.mocked(phase2Request).mockResolvedValue(record);
    await expect(readOnboarding()).resolves.toEqual(record);
  });
  it('rejects malformed checklist values instead of crashing while rendering', async () => {
    vi.mocked(phase2Request).mockResolvedValue({
      user_id: 'member', tour_key: 'member', tour_version: 1, status: 'in_progress', state: { completed_steps: 'welcome' },
    });
    await expect(readOnboarding()).rejects.toThrow('Getting Started could not be loaded');
  });
});
