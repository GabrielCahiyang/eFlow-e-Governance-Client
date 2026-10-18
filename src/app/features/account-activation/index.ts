import { lazyFeature } from '../../shared/lazyFeature';
export * from './types';
export {accountSkillsError,MAX_ACCOUNT_SKILLS,MAX_ACCOUNT_SKILL_LENGTH} from './validation';
export * from './services/activationService';
export { activationLabel, activationRoleLabel } from './selectors';
export const ActivateAccountPage = lazyFeature(() => import('./components/ActivateAccountPage').then(module => ({ default: module.ActivateAccountPage })));
