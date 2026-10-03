import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const hrmoSidebar: Record<string, SidebarContent> = {
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
      workforce: {
        title: "Workforce Analytics",
        sections: [
          {
            title: "Predictions",
            items: [
              {
                icon: <Carbon.Analytics size={16} className="text-neutral-900" />,
                label: "Burnout Prediction Radar",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Cumulative Work Experience" },
                  { label: "Response Latencies" },
                  { label: "Logged Project Hours" },
                  { label: "Office Risk Flags" },
                ],
              },
              {
                icon: <Carbon.ChartBar size={16} className="text-neutral-900" />,
                label: "Workload Velocity Metrics",
                hasDropdown: true,
                children: [
                  { label: "Task Completion Velocity" },
                  { label: "Equitable Distribution" },
                  { label: "GA Allocation Review" },
                ],
              },
            ],
          },
        ],
      },
      wellness: {
        title: "Member Wellness",
        sections: [
          {
            title: "Well-being",
            items: [
              {
                icon: <Carbon.Flag size={16} className="text-neutral-900" />,
                label: "Preemptive Interventions",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Automated Alerts" },
                  { label: "Wellness Interventions" },
                  { label: "Stress Debriefing" },
                ],
              },
              {
                icon: <Carbon.Calendar size={16} className="text-neutral-900" />,
                label: "Leave & Attendance Management",
                hasDropdown: true,
                children: [
                  { label: "Terminal Leave Credits" },
                  { label: "Monetization" },
                  { label: "Overtime Claims" },
                  { label: "Payroll Pre-Audit" },
                ],
              },
            ],
          },
        ],
      },
      compliance: {
        title: "Civil Service Compliance",
        sections: [
          {
            title: "Evaluations",
            items: [
              {
                icon: (
                  <Carbon.CheckmarkOutline size={16} className="text-neutral-900" />
                ),
                label: "Performance Evaluations",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "CSC Appraisals" },
                  { label: "Task Completion Rates" },
                  { label: "eFlow Data Integration" },
                ],
              },
            ],
          },
        ],
      },
    };
