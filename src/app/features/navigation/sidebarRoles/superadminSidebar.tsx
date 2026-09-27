import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const superadminSidebar: Record<string, SidebarContent> = {
      dashboard: {
        title: "Dashboard",
        sections: [
          {
            title: "Overview",
            items: [
              {
                icon: <Carbon.Dashboard size={16} className="text-neutral-900" />,
                label: "Dashboard Overview",
                isActive: true,
              },
            ],
          },
        ],
      },
      users: {
        title: "User Management",
        sections: [
          {
            title: "Identity & Access",
            items: [
              {
                icon: <Carbon.UserMultiple size={16} className="text-neutral-900" />,
                label: "All Users",
                isActive: true,
              },
              {
                icon: <Carbon.Security size={16} className="text-neutral-900" />,
                label: "Role Defaults",
              },
              {
                icon: <Carbon.UserAccess size={16} className="text-neutral-900" />,
                label: "User Access",
              },
            ],
          },
        ],
      },
      org_tree: {
        title: "Org Structure",
        sections: [
          {
            title: "Management",
            items: [
              {
                icon: <Carbon.Folder size={16} className="text-neutral-900" />,
                label: "Org Structure",
                isActive: true,
              },
            ],
          },
        ],
      },
      projects: {
        title: "Plans & Projects",
        sections: [
          { title: "Portfolio", items: [{ icon: <Carbon.FolderOpen size={16} className="text-neutral-900" />, label: "All Projects", isActive: true }] },
        ],
      },
      reports: {
        title: "Reports",
        sections: [
          { title: "Analytics", items: [{ icon: <Carbon.ChartBar size={16} className="text-neutral-900" />, label: "System Reports", isActive: true }] },
        ],
      },
      announcements: {
        title: "Announcements",
        sections: [
          { title: "Communications", items: [{ icon: <Carbon.Notification size={16} className="text-neutral-900" />, label: "Announcements", isActive: true }] },
        ],
      },
      permissions: {
        title: "Permissions",
        sections: [
          { title: "Access Control", items: [{ icon: <Carbon.Security size={16} className="text-neutral-900" />, label: "Permissions", isActive: true }] },
        ],
      },
      audit: {
        title: "Audit Trail",
        sections: [
          { title: "Security", items: [{ icon: <Carbon.Report size={16} className="text-neutral-900" />, label: "Audit Log", isActive: true }] },
        ],
      },
      administration: {
        title: "Administration",
        sections: [
          { title: "Configuration", items: [{ icon: <Carbon.Settings size={16} className="text-neutral-900" />, label: "System Settings", isActive: true }] },
        ],
      },
      migration: {
        title: "Data Tools",
        sections: [
          {
            title: "Tools",
            items: [
              {
                icon: <Carbon.Renew size={16} className="text-neutral-900" />,
                label: "Backup & Export",
                isActive: true,
              },
            ],
          },
        ],
      },
      settings: {
        title: "Settings",
        sections: [
          {
            title: "Configuration",
            items: [
              {
                icon: <Carbon.Settings size={16} className="text-neutral-900" />,
                label: "System Settings",
                isActive: true,
              },
            ],
          },
        ],
      },
    };
