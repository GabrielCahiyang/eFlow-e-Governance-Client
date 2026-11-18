import { createElement } from 'react';
import { CardSectionSkeleton } from '../../components/ui/SurfaceSkeletons';
import {lazyFeature} from '../../shared/lazyFeature';
export const ProjectInvitations=lazyFeature(() => import('./components/ProjectInvitations').then(m => ({default:m.ProjectInvitations})),undefined,'ProjectInvitations',createElement(CardSectionSkeleton, { rows: 2, label: 'Loading invitations…' }));
export {ProjectInvitationApprovalQueue} from './components/ProjectInvitationApprovalQueue';
export {acceptProjectInvitation,createProjectGuest,validateProjectInvitation,designateSponsor,completeProjectOnboarding} from './services/projectInvitationService';
export type {ProjectInvitation} from './types';
export {listProjectInvitations,dispatchProjectInvitation} from './services/projectInvitationService';
