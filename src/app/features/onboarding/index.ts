import { lazyFeature } from '../../shared/lazyFeature';

export const OnboardingWorkspace = lazyFeature(() =>
  import('./components/OnboardingWorkspace').then(module => ({ default: module.OnboardingWorkspace })),
);
export { OnboardingHelpButton } from './components/OnboardingHelpButton';
export { readOnboarding, saveOnboarding } from './services/onboardingService';
export { onboardingChecklist } from './checklist';
export type { OnboardingRecord } from './types';
