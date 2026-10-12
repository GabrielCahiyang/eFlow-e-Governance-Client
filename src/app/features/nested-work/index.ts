export {WorkTree} from './components/WorkTree';
export {WorkRootOwner} from './components/WorkRootOwner';
export {fetchWorkTree,fetchWorkImpact,saveWorkTree,WorkTreeUnavailable} from './services/workTreeService';
export {descendantIds,reparentChoices,leafCompletion,MAX_WORK_DEPTH,supportsNestedWork} from './selectors/tree';
export type {WorkPerson,WorkNode,WorkTreeSnapshot,WorkCommand,WorkRequest,WorkImpact} from './types';
export {selectRootWorkCapability,selectNodeWorkCapability,isCurrentWorkSnapshot} from './selectors/capabilities';
export type {RootWorkAction,NodeWorkAction,WorkCapabilityReasonCode,WorkCapabilityEntry,WorkCapabilityMap,WorkCapabilityContext,WorkActionAvailability} from './types';

export {fetchPersonalWorkRoots} from './services/workTreeService';

export {fetchOfficeWorkRoots,fetchWorkEvents,type WorkEvent} from './services/workTreeService';
export {WorkActivity} from './components/WorkActivity';
export {WorkStaffingDialog,type WorkStaffingDialogProps,type WorkStaffingController} from './components/WorkStaffingDialog';
export {WorkPeopleSummary,type WorkPeopleSummaryProps} from './components/WorkPeopleSummary';
export {WorkRootStaffingDialog} from './components/WorkRootStaffingDialog';
export {useWorkTree} from './hooks/useWorkTree';
export type {WorkTreeController,WorkHierarchyAction} from './types';
export {WorkHierarchy,type WorkHierarchyProps} from './components/WorkHierarchy';
export type {WorkTreeProps} from './components/WorkTree';
export type {WorkRootOwnerProps} from './components/WorkRootOwner';
export {buildWorkDisplayTree,selectWorkDisplayTree,expandWorkDisplayFocus,selectWorkCollapsedIds,updateWorkCollapsedIds} from './selectors/displayTree';
export type {WorkDisplayRow,WorkDisplayContext,WorkCollapseState} from './selectors/displayTree';

export { selectFocusedWorkEvents, type WorkActivityFocus } from "./selectors/workActivityScope";
export {deduplicateWorkPersonIds,resolveWorkPersonName,displayedWorkContributorIds,eligibleWorkPeople} from './selectors/people';
export {selectWorkPeopleDisplay,buildWorkNodeDisplayMetadata,buildSubtaskDisplayMetadata,mergeWorkDisplayMetadata} from './selectors/workDisplayContext';
export type {WorkDisplayScope,WorkDisplayNode,SubtaskDisplayRecord} from './selectors/workDisplayContext';
export type {WorkPeopleDisplay,WorkNodeDisplayMetadata} from './types';
export {buildWorkRecordDisplayMetadata,type WorkDisplayRootRecord} from './selectors/recordDisplayContext';
export {presentWorkEvent,workEventTitle,isWorkEventRecord,type WorkEventPresentation} from './selectors/workEventPresentation';
