import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const councilor_padSidebar: Record<string, SidebarContent> = {
      workspace: {
        title: "Office Workspace",
        sections: [
          {
            title: "Dashboard",
            items: [
              {
                icon: <Carbon.FolderOpen size={16} className="text-neutral-900" />,
                label: "Blank Dashboard",
                isActive: true,
              },
            ],
          },
        ],
      },
    };
