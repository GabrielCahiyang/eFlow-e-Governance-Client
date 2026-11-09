import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const settingsContent: SidebarContent = {
    title: "Settings",
    sections: [
      {
        title: "Account",
        items: [
          {
            icon: <Carbon.User size={16} className="text-neutral-900" />,
            label: "Profile",
          },
          {
            icon: <Carbon.Settings size={16} className="text-neutral-900" />,
            label: "Appearance",
          },
          {
            icon: <Carbon.Notification size={16} className="text-neutral-900" />,
            label: "Notifications",
          },
          {
            icon: <Carbon.Settings size={16} className="text-neutral-900" />,
            label: "Security",
          },
          {
            icon: <Carbon.DataBase size={16} className="text-neutral-900" />,
            label: "Storage & cache",
          },
        ],
      },
    ],
  };
