import { lazyFeature } from "../../shared/lazyFeature";
export * from "../../services/employeeService";
export * from "../../services/employeeNotesService";
export const ProfilePage = lazyFeature(() =>
  import("../../components/Member/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
  undefined,
  "ProfilePage",
);
export { useDeptDirectoryEmployees } from "./hooks/useDeptDirectoryEmployees";
export const EmployeeMyTasks = lazyFeature(() =>
  import("./components/core-work/EmployeeMyTasks").then((module) => ({
    default: module.EmployeeMyTasks,
  })),
  undefined,
  "EmployeeMyTasks",
);
export const EmployeeMyProjects = lazyFeature(() =>
  import("./components/core-work/EmployeeMyProjects").then((module) => ({
    default: module.EmployeeMyProjects,
  })),
  undefined,
  "EmployeeMyProjects",
);
export const EmployeeTaskHistory = lazyFeature(() =>
  import("./components/core-work/EmployeeTaskHistory").then((module) => ({
    default: module.EmployeeTaskHistory,
  })),
  undefined,
  "EmployeeTaskHistory",
);
export const EmployeeDeadlines = lazyFeature(() =>
  import("./components/core-work/EmployeeDeadlines").then((module) => ({
    default: module.EmployeeDeadlines,
  })),
  undefined,
  "EmployeeDeadlines",
);
export const EmployeeWorkReport = lazyFeature(() =>
  import("./components/core-work/EmployeeWorkReport").then((module) => ({
    default: module.EmployeeWorkReport,
  })),
  undefined,
  "EmployeeWorkReport",
);
export * from "./services/pds-parser";
