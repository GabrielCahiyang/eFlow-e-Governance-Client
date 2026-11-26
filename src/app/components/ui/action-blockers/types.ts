export type ActionBlockerCategory =
  | "head_approval"
  | "accounting_approval"
  | "lead_review"
  | "partner_approval"
  | "admin_approval"
  | "separation_of_duties"
  | "financial_gate"
  | "dependency"
  | "readiness"
  | "permission"
  | "validation";

export interface ActionBlockerItem {
  id: string;
  category: ActionBlockerCategory;
  title: string;
  detail: string;
  waitingOn?: string;
  statusLabel?: string;
  /** Optional PHP amount in pesos (rendered centavo-safely as ₱#,###.##). */
  amount?: number;
  /** Optional ISO date/timestamp or epoch ms (rendered in Asia/Manila PH time). */
  dueAt?: string | number;
  /** Optional direct navigation/fix button when the current user can resolve it. */
  actionLabel?: string;
  onAction?: () => void;
}

export type ActionBlockerInput =
  | string
  | null
  | undefined
  | false
  | ActionBlockerItem
  | Array<string | ActionBlockerItem | null | undefined | false>;
