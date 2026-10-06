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
export const ProjectOfficePanel = lazyFeature(() =>
  import("./components/ProjectOfficePanel").then((module) => ({
    default: module.ProjectOfficePanel,
  })),
  undefined,
  "ProjectOfficePanel",
);
export const TaskOfficeControl = lazyFeature(() =>
  import("./components/TaskOfficeControl").then((module) => ({
    default: module.TaskOfficeControl,
  })),
  undefined,
  "TaskOfficeControl",
);
