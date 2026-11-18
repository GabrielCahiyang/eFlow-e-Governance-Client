import { createElement } from 'react';
import { ProjectViewLoading } from '../../components/workflow/ProjectWorkspaceSkeleton';
import {lazyFeature} from '../../shared/lazyFeature';
export const ProjectMembers=lazyFeature(() => import('./components/ProjectMembers').then(m => ({default:m.ProjectMembers})),undefined,'ProjectMembers',createElement(ProjectViewLoading, { view: 'members' }));
export {fetchMembers,saveMemberTerms} from './services/memberService';
export type {MembersSnapshot,SelectedMember,Engagement} from './types';
