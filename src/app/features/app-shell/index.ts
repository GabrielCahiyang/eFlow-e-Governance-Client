import { createElement } from "react";
import { lazyFeature } from "../../shared/lazyFeature";
import { LoadingScreen } from "./LoadingScreen";

export { AppProviders } from "./AppProviders";
export { AuthenticatedApp } from "./AuthenticatedApp";
export const EflowAppShell = lazyFeature(
  () => import("./EflowAppShell").then((module) => ({ default: module.EflowAppShell })),
  undefined,
  undefined,
  createElement(LoadingScreen),
);
export { QuickLoginListener } from "./QuickLoginListener";
export { mapRoleToPanel } from "./role";
