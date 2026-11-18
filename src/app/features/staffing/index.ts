import { createElement } from "react";
import { DialogSkeleton } from "../../components/ui/SurfaceSkeletons";
import { lazyFeature } from "../../shared/lazyFeature";
export const StaffingDialog = lazyFeature(
  () =>
    import("./components/StaffingDialog").then((module) => ({
      default: module.StaffingDialog,
    })),
  undefined,
  "StaffingDialog",
  createElement(DialogSkeleton, { label: "Loading staffing…" }),
);

export { staffingEntryReason } from "./presentation";
export {AutoAssignTaskButton} from './components/AutoAssignTaskButton';
export {prepareImportAssignment} from './services/importAssignment';
export {assignRemainingOfficeWork} from './services/remainingOfficeWork';
