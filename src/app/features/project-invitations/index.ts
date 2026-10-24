import {lazyFeature} from '../../shared/lazyFeature';
export const ProjectInvitations=lazyFeature(() => import('./components/ProjectInvitations').then(m => ({default:m.ProjectInvitations})),undefined,'ProjectInvitations');
export {ProjectInvitationApprovalQueue} from './components/ProjectInvitationApprovalQueue';
export {acceptProjectInvitation,createProjectGuest,validateProjectInvitation,designateSponsor} from './services/projectInvitationService';
export type {ProjectInvitation} from './types';
export {listProjectInvitations,dispatchProjectInvitation} from './services/projectInvitationService';
