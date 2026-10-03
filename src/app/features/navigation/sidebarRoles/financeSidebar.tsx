import * as Carbon from "@carbon/icons-react";
import type { SidebarContent } from "../sidebarTypes";

export const financeSidebar: Record<string, SidebarContent> = {
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
      projfin: {
        title: "Project Financials",
        sections: [
          {
            title: "Budget Management",
            items: [
              {
                icon: <Carbon.Dashboard size={16} className="text-neutral-900" />,
                label: "Master Budget Allocation",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Programmatic Buckets" },
                  { label: "Facilities Budget" },
                  { label: "Marketing Budget" },
                  { label: "Community Engagement" },
                ],
              },
              {
                icon: <Carbon.Share size={16} className="text-neutral-900" />,
                label: "Program Fund Distribution",
                hasDropdown: true,
                children: [
                  { label: "Fund Releases" },
                  { label: "Obligation Requests (ORS)" },
                  { label: "Earmarked Funds" },
                ],
              },
            ],
          },
        ],
      },
      liquidation: {
        title: "Expense & Liquidation Audit",
        sections: [
          {
            title: "Audit Queue",
            items: [
              {
                icon: <Carbon.Pending size={16} className="text-neutral-900" />,
                label: "Pending Liquidations",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Receipt Verification" },
                  { label: "Exact Cost Review" },
                  { label: "Cash Advance Matching" },
                ],
              },
              {
                icon: <Carbon.Renew size={16} className="text-neutral-900" />,
                label: "Budget Reconciliation & Returns",
                hasDropdown: true,
                children: [
                  { label: "Unspent Funds" },
                  { label: "Cryptographic Verification" },
                  { label: "LGU Pool Returns" },
                ],
              },
            ],
          },
        ],
      },
      crypto: {
        title: "Cryptographic Accountability",
        sections: [
          {
            title: "Blockchain Audit",
            items: [
              {
                icon: <Carbon.Security size={16} className="text-neutral-900" />,
                label: "Immutable Expense Ledger",
                isActive: true,
                hasDropdown: true,
                children: [
                  { label: "Hashed Liquidations" },
                  { label: "Non-Repudiation Records" },
                  { label: "Blockchain Commits" },
                ],
              },
              {
                icon: <Carbon.Flag size={16} className="text-neutral-900" />,
                label: "Real-Time Conformance Alerts",
                hasDropdown: true,
                children: [
                  { label: "Public Bidding Bypasses" },
                  { label: "COA Timeline Flags" },
                  { label: "30-Day Liquidation Alerts" },
                ],
              },
            ],
          },
        ],
      },
    };
