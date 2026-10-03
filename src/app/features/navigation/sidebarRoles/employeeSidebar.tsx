import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const employeeSidebar: Record<string, SidebarContent> = {
      mywork: {
        title: "My Work",
        sections: [
          {
            title: "Daily work",
            items: [
              { icon: <Carbon.Task size={16} className="text-neutral-900" />, label: "My Tasks", isActive: true },
              { icon: <Carbon.StarFilled size={16} className="text-neutral-900" />, label: "Pinned — You're Leading" },
              { icon: <Carbon.Calendar size={16} className="text-neutral-900" />, label: "Deadlines" },
              { icon: <Carbon.Time size={16} className="text-neutral-900" />, label: "Task History" },
              { icon: <Carbon.Notification size={16} className="text-neutral-900" />, label: "Announcements" },
              { icon: <Carbon.Report size={16} className="text-neutral-900" />, label: "My Work Report" },
            ],
          },
        ],
      },
      leader: {
        title: "Leader Workspace",
        sections: [
          {
            title: "Team Leadership",
            items: [
              {
                icon: <Carbon.StarFilled size={16} className="text-neutral-900" />,
                label: "Pinned — You're Leading",
                isActive: true,
              },
              {
                icon: <Carbon.CheckmarkOutline size={16} className="text-neutral-900" />,
                label: "For Review",
              },
              {
                icon: <Carbon.Group size={16} className="text-neutral-900" />,
                label: "Team Workload",
              },
            ],
          },
        ],
      },
      workspace: {
        title: "Office Workspace",
        sections: [
          {
            title: "Dashboard",
            items: [
              {
                icon: <Carbon.Task size={16} className="text-neutral-900" />,
                label: "My Task Workspace",
                isActive: true,
              },
              {
                icon: <Carbon.ChartBar size={16} className="text-neutral-900" />,
                label: "My Performance Overview",
              },
            ],
          },
        ],
      },
    };
