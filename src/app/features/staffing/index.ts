import { lazyFeature } from "../../shared/lazyFeature";
export const StaffingDialog = lazyFeature(
  () =>
    import("./components/StaffingDialog").then((module) => ({
      default: module.StaffingDialog,
    })),
  undefined,
  "StaffingDialog",
);

export { staffingEntryReason } from "./presentation";
export {AutoAssignTaskButton} from './components/AutoAssignTaskButton';
export {prepareImportAssignment} from './services/importAssignment';
export {assignRemainingOfficeWork} from './services/remainingOfficeWork';
