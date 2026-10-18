import { Settings } from "lucide-react";
import { AnnouncementCenter } from "../workflow/AnnouncementCenter";
import { LeaderReviewInbox } from "../Head/ForReviewInbox";
import { SubtasksWorkspace } from "../workflow/SubtasksWorkspace";
import {
  RolePageRouter,
  type RolePageSections,
} from "../Layout/RolePageRouter";
import {
  EmployeeDeadlines,
  EmployeeTaskHistory,
  EmployeeWorkReport,
} from "./EmployeeCoreWork";
import { EmployeePerformanceView } from "./EmployeePerformanceView";
import { EmployeeTaskWorkspace } from "./EmployeeTaskWorkspace";
import { EmployeeProjectsWorkspace } from "../../features/projects";

/**
 * Thin employee route manifest. The previous file mixed routing with more than
 * two thousand lines of disconnected prototype screens; active workflow pages
 * now live in focused components and share one task data source.
 */
export const employeePages: RolePageSections = {
  tasks: {
    "My Tasks": EmployeeTaskWorkspace,
  },
  projects: {
    Projects: EmployeeProjectsWorkspace,
  },
  subtasks: {
    "My Subtasks": SubtasksWorkspace,
  },
  reviews: {
    "Leader Reviews": LeaderReviewInbox,
  },
  deadlines: {
    Deadlines: EmployeeDeadlines,
  },
  history: {
    "Task History": EmployeeTaskHistory,
  },
  performance: {
    Performance: EmployeePerformanceView,
  },
  reports: {
    "Work Report": EmployeeWorkReport,
  },
  announcements: {
    Announcements: AnnouncementCenter,
  },

};

export const employeeDefaultPages: Record<string, string> = {
  tasks: "My Tasks",
  projects: "Projects",
  subtasks: "My Subtasks",
  reviews: "Leader Reviews",
  deadlines: "Deadlines",
  history: "Task History",
  performance: "Performance",
  reports: "Work Report",
  announcements: "Announcements",
};

export function MemberContent({
  activeSection,
  activePage,
}: {
  activeSection: string;
  activePage?: string;
}) {
  return (
    <RolePageRouter
      sections={employeePages}
      defaults={employeeDefaultPages}
      activeSection={activeSection}
      activePage={activePage}
      fallback={(_section, page) => (
        <div className="flex h-full items-center justify-center text-center text-neutral-400">
          <div>
            <Settings size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-normal">
              Page unavailable
            </p>
            <p className="mt-1 text-[12px]">{page || "Member workspace"}</p>
          </div>
        </div>
      )}
    />
  );
}

export default MemberContent;
