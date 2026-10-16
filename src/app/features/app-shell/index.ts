import { lazyFeature } from "../../shared/lazyFeature";

export { AppProviders } from "./AppProviders";
export { AuthenticatedApp } from "./AuthenticatedApp";
export const EflowAppShell = lazyFeature(() =>
  import("./EflowAppShell").then((module) => ({ default: module.EflowAppShell })),
);
export { QuickLoginListener } from "./QuickLoginListener";
export { mapRoleToPanel } from "./role";
