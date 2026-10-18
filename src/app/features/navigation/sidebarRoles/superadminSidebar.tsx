import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const superadminSidebar: Record<string, SidebarContent> = {
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
              { icon:<Carbon.Security size={16}/>, label:'Locked out accounts' },
              {
                icon: <Carbon.UserAccess size={16} className="text-neutral-900" />,
                label: "User Access",
              },
            ],
          },
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
    };
