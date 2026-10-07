import { getCoreSidebarContent } from "../../components/Layout/coreWorkflowNavigation";
import { getRoleNavigation } from "./roleNavigation";
import { settingsContent, sidebarContentByRole } from "./sidebarRoles";
import type { SidebarContent } from "./sidebarTypes";
import { isAdministrativeNavigationSection } from "./navigationPermissions";

export type { MenuItem, MenuSection, SidebarContent } from "./sidebarTypes";

export function getSidebarContent(
  role: string,
  section: string,
): SidebarContent {
  if (section === "personal_work" || section === "inbox")
    return {
      title: section === "inbox" ? "Inbox" : "My Work",
      sections: [
        {
          title: "Personal",
          items: [
            {
              label: section === "inbox" ? "Inbox" : "My Work",
              isActive: true,
            },
          ],
        },
      ],
    };
  if (section === "settings") return settingsContent;
  if ((role === "head" || role === "dept_head") && section === "team")
    return {
      title: "Office Team",
      sections: [
        {
          title: "People",
          items: [
            { label: "Team Supervision", isActive: true },
            { label: "Office Team" },
          ],
        },
      ],
    };

  if (role === "admin" && section === "users")
    return {
      title: "User Management",
      sections: [
        {
          title: "Administration",
          items: [
            { label: "All Users", isActive: true },
            { label: 'Locked out accounts' },
            { label: "Role Defaults" },
            { label: "User Access" },
            { label: "Office Structure" },
            { label: "Account Audit" },
            { label: "System Settings" },
            { label: "Backup & Export" },
          ],
        },
      ],
    };
  if (role === "accounting_staff" && section === "accounting_releases")
    return {
      title: "Voucher & Cash Releases",
      sections: [
        {
          title: "Accounting",
          items: [
            { label: "Voucher & Cash Releases" },
            { label: "Settlements" },
          ],
        },
      ],
    };
  const coreContent = getCoreSidebarContent(role, section);
  if (coreContent) return coreContent;

  const roleMap = sidebarContentByRole[role];
  if (roleMap?.[section]) return roleMap[section];

  if (role !== "admin" && isAdministrativeNavigationSection(section)) {
    const administrativeContent = sidebarContentByRole.admin?.[section];
    if (administrativeContent) return administrativeContent;
  }

  const config = getRoleNavigation(role);
  const navItem = config.navItems.find((item) => item.id === section);
  if (navItem) {
    return {
      title: navItem.label,
      sections: [
        {
          title: "Workspace",
          items: [{ label: navItem.label, isActive: true }],
        },
      ],
    };
  }

  return { title: "Dashboard", sections: [] };
}
