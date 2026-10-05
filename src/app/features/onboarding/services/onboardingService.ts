import { jsonRequest, phase2Request } from '../../../shared/phase2Api';
import type { OnboardingRecord } from '../types';
function validatedRecord(value: unknown): OnboardingRecord {
  const record = value as Partial<OnboardingRecord> | null;
  const state = record?.state;
  if (!record || typeof record.user_id !== 'string' || typeof record.tour_key !== 'string'
    || typeof record.tour_version !== 'number'
    || !['not_started', 'in_progress', 'completed', 'dismissed'].includes(record.status || '')
    || !state || typeof state !== 'object' || Array.isArray(state)
    || [state.completed_steps, state.interests].some(list => list !== undefined
      && (!Array.isArray(list) || list.some(item => typeof item !== 'string')))) {
    throw new Error('Getting Started could not be loaded. Please try again later.');
  }
  return record as OnboardingRecord;
}

export const readOnboarding = async () => validatedRecord(await phase2Request<unknown>('/onboarding/me'));
export const saveOnboarding = async (changes: { status?: OnboardingRecord['status']; current_step?: string; completed_steps?: string[]; interests?: string[]; tour_progress?: unknown }) => validatedRecord(await phase2Request<unknown>('/onboarding/me', jsonRequest('PATCH', changes)));
