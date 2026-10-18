import type { SidebarContent } from "../sidebarTypes";
import { superadminSidebar } from "./superadminSidebar";

export { settingsContent } from "./settingsSidebar";

export const sidebarContentByRole: Record<string, Record<string, SidebarContent>> = {
  admin: superadminSidebar,
};
