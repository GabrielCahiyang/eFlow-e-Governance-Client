export type AccountingWorkspaceView =
  | "overview"
  | "releases"
  | "settlements"
  | "journal"
  | "audit"
  | "budgets";
export const ACCOUNTING_VIEWS: {
  id: AccountingWorkspaceView;
  label: string;
  section: string;
  page: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    section: "accounting_overview",
    page: "Accounting Overview",
  },
  {
    id: "releases",
    label: "Releases",
    section: "accounting_releases",
    page: "Voucher & Cash Releases",
  },
  {
    id: "settlements",
    label: "Settlements",
    section: "accounting_releases",
    page: "Settlements",
  },
  {
    id: "journal",
    label: "Journal",
    section: "accounting_journal",
    page: "General Journal",
  },
  {
    id: "audit",
    label: "History",
    section: "accounting_audit",
    page: "Financial Audit Trail",
  },
  {
    id: "budgets",
    label: "Budget ledger",
    section: "accounting_budgets",
    page: "Office Budget Ledgers",
  },
];
export function resolveAccountingView(
  section: string,
  page?: string,
): AccountingWorkspaceView {
  if (section === "accounting_releases" && page === "Settlements")
    return "settlements";
  return (
    ACCOUNTING_VIEWS.find((item) => item.section === section)?.id || "overview"
  );
}
