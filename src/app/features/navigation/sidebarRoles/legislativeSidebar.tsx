import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const legislativeSidebar: Record<string, SidebarContent> = {
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
      legdash: {
        title: "Legislative Dashboard",
        sections: [
          {
            title: "Measures",
            items: [
              {
                icon: <Carbon.Task size={16} className="text-neutral-900" />,
                label: "Active Measures Pipeline",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "First Reading" },
                  { label: "Committee Level" },
                  { label: "Second Reading" },
                  { label: "Third Reading" },
                  { label: "Mayoral Approval" },
                ],
              },
              {
                icon: <Carbon.Archive size={16} className="text-neutral-900" />,
                label: "Adopted Ordinances Archive",
                hasDropdown: true,
                children: [
                  { label: "Semantic Search" },
                  { label: "Full Index" },
                ],
              },
            ],
          },
        ],
      },
      session: {
        title: "Session Management",
        sections: [
          {
            title: "Sessions",
            items: [
              {
                icon: <Carbon.DocumentAdd size={16} className="text-neutral-900" />,
                label: "Order of Business",
                isActive: true,
              },
              {
                icon: <Carbon.Report size={16} className="text-neutral-900" />,
                label: "Minutes & Transcripts",
                hasDropdown: true,
                children: [
                  { label: "NLP Transcription" },
                  { label: "Session Summaries" },
                  { label: "Archived Minutes" },
                ],
              },
            ],
          },
        ],
      },
      committee: {
        title: "Committee Affairs",
        sections: [
          {
            title: "Committees",
            items: [
              {
                icon: <Carbon.Analytics size={16} className="text-neutral-900" />,
                label: "Appropriations & Finance",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Proposed Municipal Budget" },
                  { label: "Budget Legislation" },
                ],
              },
              {
                icon: <Carbon.Group size={16} className="text-neutral-900" />,
                label: "Sectoral Committees",
                hasDropdown: true,
                children: [
                  { label: "Committee Chairmanships" },
                  { label: "Working Documents" },
                ],
              },
            ],
          },
        ],
      },
    };
