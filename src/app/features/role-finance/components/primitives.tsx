import type { ReactNode } from "react";
import { CreditCard } from "@vibe/icons";
import {
  PageHeader as WorkflowPageHeader,
  StatCard as WorkflowStatCard,
  WButton,
} from "../../../components/workflow/primitives";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return <WorkflowPageHeader actions={actions} eyebrow={<><CreditCard aria-hidden="true" size={14} /> Finance · Operational Ledger</>} subtitle={subtitle || "Office of the City Accountant & Treasurer · Ormoc City"} title={title} />;
}

export function Btn({ icon, label, variant = "secondary", onClick, disabled }: { icon?: ReactNode; label: string; variant?: "primary" | "secondary" | "danger" | "success"; onClick?: () => void; disabled?: boolean }) {
  return <WButton disabled={disabled} icon={icon} onClick={onClick} size="small" variant={variant}>{label}</WButton>;
}

export function Stat({ label, value, trend, tone = "neutral" }: { label: string; value: string; trend?: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return <WorkflowStatCard hint={trend} label={label} tone={tone} value={value} />;
}

export const peso = (value: number, decimals = 0) => `₱${value.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
export const pesoShort = (value: number) => value >= 1_000_000_000 ? `₱${(value / 1_000_000_000).toFixed(2)}B` : value >= 1_000_000 ? `₱${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `₱${(value / 1_000).toFixed(0)}K` : `₱${value}`;
