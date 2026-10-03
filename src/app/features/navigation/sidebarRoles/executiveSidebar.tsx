import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const executiveSidebar: Record<string, SidebarContent> = {
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
      portfolio: {
        title: "Executive Portfolio",
        sections: [
          {
            title: "Overview",
            items: [
              {
                icon: <Carbon.Dashboard size={16} className="text-neutral-900" />,
                label: "City Project Pulse",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Portfolio Completion Rates" },
                  { label: "Budget Burn-Down" },
                  { label: "Critical Bottlenecks" },
                ],
              },
              {
                icon: <Carbon.StarFilled size={16} className="text-neutral-900" />,
                label: "Strategic AI Insights",
                hasDropdown: true,
                children: [
                  { label: "Predictive Insight Cards" },
                  { label: "Procurement Delay Alerts" },
                  { label: "Actionable Intelligence" },
                ],
              },
            ],
          },
        ],
      },
      transform: {
        title: "Project Transform",
        sections: [
          {
            title: "Initiatives",
            items: [
              {
                icon: <Carbon.Home size={16} className="text-neutral-900" />,
                label: "Sustainable Tourism & Eco-Resorts",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Infrastructure (â‚±450M)" },
                  { label: "Environmental Protection (â‚±170M)" },
                  { label: "Revenue Projections" },
                ],
              },
              {
                icon: <Carbon.Renew size={16} className="text-neutral-900" />,
                label: "Marine Litter & Circular Economy",
                hasDropdown: true,
                children: [
                  { label: "#SHInEOrmoc Initiative" },
                  { label: "Plastic Regulation Compliance" },
                  { label: "Trash Trap Interception Rates" },
                ],
              },
            ],
          },
        ],
      },
      financial: {
        title: "Financial Oversight",
        sections: [
          {
            title: "Budget Monitoring",
            items: [
              {
                icon: <Carbon.ChartBar size={16} className="text-neutral-900" />,
                label: "Master Budget Execution",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Expenditure vs Approved" },
                  { label: "Overspending Risk" },
                  { label: "Underutilization Alerts" },
                ],
              },
              {
                icon: <Carbon.Security size={16} className="text-neutral-900" />,
                label: "Unliquidated Cash Advances",
                hasDropdown: true,
                children: [
                  { label: "Outstanding Funds" },
                  { label: "Leader Tracking" },
                  { label: "Stalled Funds Alert" },
                ],
              },
            ],
          },
        ],
      },
      audit: {
        title: "Immutable Audit Review",
        sections: [
          {
            title: "Cryptographic Records",
            items: [
              {
                icon: <Carbon.DocumentAdd size={16} className="text-neutral-900" />,
                label: "Cryptographic Ledger",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Financial Disbursements" },
                  { label: "Project Liquidations" },
                  { label: "Returned Funds" },
                ],
              },
            ],
          },
        ],
      },
    };
