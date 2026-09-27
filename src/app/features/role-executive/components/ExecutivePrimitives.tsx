import * as React from "react";
import { Button, Heading, Label, Text } from "@vibe/core";

const pillStyles: Record<string, string> = {
  Healthy: "bg-emerald-100 text-emerald-700",
  "On Track": "bg-emerald-100 text-emerald-700",
  Warning: "bg-amber-100 text-amber-700",
  "At Risk": "bg-amber-100 text-amber-700",
  Critical: "bg-red-100 text-red-700",
  Breached: "bg-red-100 text-red-700",
  Delayed: "bg-red-100 text-red-700",
  "Under Review": "bg-blue-100 text-blue-700",
  Active: "bg-emerald-100 text-emerald-700",
  Stalled: "bg-red-100 text-red-700",
  Resolved: "bg-neutral-100 text-neutral-500",
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-emerald-100 text-emerald-700",
  Fast: "bg-emerald-100 text-emerald-700",
  Moderate: "bg-amber-100 text-amber-700",
  Slow: "bg-red-100 text-red-700",
  Positive: "bg-emerald-100 text-emerald-700",
  Negative: "bg-red-100 text-red-700",
};

export function Pill({ status }: { status: string }) {
  const style = pillStyles[status] || "";
  const color = style.includes("red") ? "negative" : style.includes("amber") ? "working_orange" : style.includes("emerald") ? "positive" : style.includes("blue") ? "bright-blue" : "dark";
  return <span aria-label={`Status: ${status}`} role="status"><Label color={color} text={status} /></span>;
}

export function PageHeader({ title, actions }: { title: string; actions: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Heading className="text-neutral-900" type="h1" weight="medium">{title}</Heading>
        <Text className="mt-1 text-neutral-500" type="text2">Executive Portfolio · Ormoc City LGU</Text>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}

export function ActionButton({ icon, label, variant = "secondary" }: { icon: React.ReactNode; label: string; variant?: "primary" | "secondary" | "danger" }) {
  const styles = { primary: { kind: "primary", color: "primary" }, secondary: { kind: "secondary", color: "primary" }, danger: { kind: "secondary", color: "negative" } } as const;
  return <Button color={styles[variant].color} kind={styles[variant].kind} size="small"><span aria-hidden="true" className="inline-flex">{icon}</span>{label}</Button>;
}

export function StatCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up" | "down" | "flat" }) {
  return (
    <section aria-label={label} className="min-w-[160px] flex-1 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <Text className="uppercase tracking-[0.08em] text-muted-foreground" type="text3" weight="medium">{label}</Text>
      <p className="eflow-tabular mt-1 text-[24px] font-semibold text-foreground">{value}</p>
      {sub && (
        <p className={`mt-1 text-[11px] ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
          {trend === "up" ? "↑ " : trend === "down" ? "↓ " : ""}{sub}
        </p>
      )}
    </section>
  );
}

// ==================== BATTERY WIDGET ====================
export function BatteryWidget({ project, completion, workforce, phases, status }: {
  project: string; completion: number; workforce: number; status: string;
  phases: { name: string; pct: number; color: string }[];
}) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-neutral-900">{project}</h3>
          <p className="text-[11px] font-normal text-neutral-500 mt-0.5">Overall: {completion}% Complete · Active Workforce: {workforce} Staff</p>
        </div>
        <Pill status={status} />
      </div>
      {/* Battery bar */}
      <div className="flex rounded-full overflow-hidden h-6 bg-neutral-100">
        {phases.map((p, i) => (
          <div key={i} className="relative flex items-center justify-center" style={{ width: `${p.pct}%`, backgroundColor: p.color }}>
            {p.pct > 10 && <span className="text-[9px] font-medium text-white drop-shadow-sm">{p.name}</span>}
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2.5">
        {phases.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[10px] font-normal text-neutral-500">{p.name} ({p.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 1. PORTFOLIO COMPLETION RATES ====================
