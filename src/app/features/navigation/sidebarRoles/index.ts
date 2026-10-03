import type { SidebarContent } from "../sidebarTypes";
import { superadminSidebar } from "./superadminSidebar";
import { deptheadSidebar } from "./deptheadSidebar";
import { employeeSidebar } from "./employeeSidebar";

export { settingsContent } from "./settingsSidebar";

export const sidebarContentByRole: Record<string, Record<string, SidebarContent>> = {
  admin: superadminSidebar,
  head: deptheadSidebar,
  member: employeeSidebar,
  accounting_staff: employeeSidebar,
};
