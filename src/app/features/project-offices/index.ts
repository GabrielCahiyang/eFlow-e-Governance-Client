import { createElement } from "react";
import {
  CardSectionSkeleton,
  InlineCellSkeleton,
} from "../../components/ui/SurfaceSkeletons";
import { lazyFeature } from "../../shared/lazyFeature";
export type {
  ProjectOffice,
  ProjectOfficeMember,
  ProjectOfficeState,
  OfficeIdentity,
} from "./types";
export {
  ProjectOfficeContext,
  useProjectOfficeContext,
  useProjectOffices,
  prefetchProjectOffices,
} from "./hooks/useProjectOffices";
export {
  canStaffProjectOffice,
  canHandoverTask,
  projectOfficePeople,
} from "./selectors";
export {
  setResponsibleOffice,
  moveProjectOfficeTask,
} from "./services/projectOfficeService";
export {
  proposeTaskOffice,
  resolveTaskOffice,
} from "./services/officeIdentityService";
export const TaskOfficeControl = lazyFeature(
  () =>
    import("./components/TaskOfficeControl").then((module) => ({
      default: module.TaskOfficeControl,
    })),
  undefined,
  "TaskOfficeControl",
  createElement(InlineCellSkeleton, { label: "Loading office…" }),
);
export const ProjectPeoplePage = lazyFeature(
  () =>
    import("./components/ProjectPeoplePage").then((module) => ({
      default: module.ProjectPeoplePage,
    })),
  undefined,
  "ProjectPeoplePage",
  createElement(CardSectionSkeleton, {
    rows: 4,
    label: "Loading project people…",
  }),
);
export { OfficeMembersEditor } from "./components/OfficeMembersEditor";
