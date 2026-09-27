import React from "react";
import { Label } from "@vibe/core";
import {
  PageHeader as WorkflowPageHeader,
  StatCard as WorkflowStatCard,
  WButton,
} from "../../../../components/workflow/primitives";

export const pillColors: Record<string, React.ComponentProps<typeof Label>["color"]> = {
  "LIVE SESSION ACTIVE": "negative", Completed: "positive", Pending: "working_orange",
  Broadcasting: "positive", "Up Next": "bright-blue", Paused: "egg_yolk", Deferred: "working_orange",
  Done: "positive", Skipped: "dark", Published: "positive", Draft: "working_orange",
  "AI Generated": "bright-blue", Finalized: "positive", "Unfinished Business": "dark-orange",
};

export function Pill({ status }: { status: string }) {
  return (
    <span aria-label={`Status: ${status}`} role="status"><Label color={pillColors[status] || "dark"} text={status} /></span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions: React.ReactNode }) {
  return <WorkflowPageHeader actions={actions} subtitle={subtitle || "Sangguniang Panlungsod · Ormoc City"} title={title} />;
}

export function Btn({ icon, label, variant = "secondary" }: { icon: React.ReactNode; label: string; variant?: "primary" | "secondary" | "danger" | "success" | "live" }) {
  const workflowVariant = variant === "live" ? "danger" : variant;
  return <WButton icon={icon} size="small" variant={workflowVariant}>{label}</WButton>;
}

export function StatCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up" | "down" | "flat" }) {
  const hint = sub && trend === "up" ? `↑ ${sub}` : sub && trend === "down" ? `↓ ${sub}` : sub;
  const tone = trend === "up" ? "good" : trend === "down" ? "bad" : "neutral";
  return <WorkflowStatCard hint={hint} label={label} tone={tone} value={value} />;
}

// ==================== BROADCAST HISTORY ====================
