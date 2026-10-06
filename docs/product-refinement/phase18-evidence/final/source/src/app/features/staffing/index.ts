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
