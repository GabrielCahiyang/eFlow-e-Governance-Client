import { describe, expect, it } from 'vitest';
import { onboardingChecklist } from '../../src/app/features/onboarding/checklist';
import { getPageTourSteps } from '../../src/app/features/guided-tours/tourCatalog';

describe('Phase 2 role-aware onboarding', () => {
  it('gives Heads the invitation path and Accounting Staff their own finance guidance', () => {
    expect(onboardingChecklist('head').some(step => step.page === 'Office Team')).toBe(true);
    expect(onboardingChecklist('member').some(step => step.page === 'Office Team')).toBe(false);
    expect(onboardingChecklist('accounting_staff').some(step => step.section === 'accounting_releases')).toBe(true);
  });
  it('focuses Office Team guidance on the actual team and invite controls', () => {
    expect(getPageTourSteps('team', 'Office Team').map(step => step.target)).toEqual(["[data-tour-id='office-team']", "[data-tour-id='invite-member']"]);
  });
});
