import type { SealState } from "./types";
export const sealLabels: Record<SealState, string> = {
  preparing: "Preparing records and files",
  review_ready: "Ready for your review",
  queued: "Waiting to publish",
  uploading: "Saving public archive",
  broadcast: "Sending Amoy transaction",
  confirming: "Waiting for the blockchain to finalize the transaction",
  confirmed: "Seal recorded on Polygon Amoy",
  failed: "Publication stopped",
  simulation: "Simulation finished",
  cancelled: "Preview discarded",
};
export const isSealPending = (state?: SealState) =>
  !!state &&
  ["preparing", "queued", "uploading", "broadcast", "confirming"].includes(
    state,
  );
const SECTION_LABELS: Record<string, string> = {
  financial_closeout: "Financial closeout summary",
  funding_requests: "Funding & supplemental certifications",
  work_cash_assignments: "Cash assignments & Office Petty Cash",
  work_cash_assignment_receipts: "Cash assignment receipts",
  office_petty_cash_events: "Office Petty Cash ledger events",
  task_activities: "Task activities & budget logs",
  project_field_history: "Project field & funding return history",
  status_history: "Task status history",
  budget_ledger: "Budget ledger entries",
  journal_entries: "General journal entries",
  journal_lines: "General journal lines",
};

export const sectionLabel = (key: string) =>
  SECTION_LABELS[key] ??
  key.replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase());
export function publicRecordUrl(id: string) {
  const configuredBase = (
    import.meta.env.VITE_PUBLIC_PORTAL_URL as string | undefined
  )
    ?.trim()
    .replace(/\/+$/, "");
  const base = configuredBase || window.location.origin;
  return `${base}/project-record/${encodeURIComponent(id)}`;
}
