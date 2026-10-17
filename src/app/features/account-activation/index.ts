import { lazyFeature } from '../../shared/lazyFeature';
export * from './types';
export * from './services/activationService';
export { activationLabel, activationRoleLabel } from './selectors';
export const ActivateAccountPage = lazyFeature(() => import('./components/ActivateAccountPage').then(module => ({ default: module.ActivateAccountPage })));
