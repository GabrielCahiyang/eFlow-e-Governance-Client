import * as React from "react";
import { Button, Heading, Label, Loader, Text } from "@vibe/core";
import { Locked, Security, Warning } from "@vibe/icons";

const pillMap: Record<string, string> = {
  "Cycle Sealed": "bg-blue-100 text-blue-700 border border-blue-200",
  "Audit Mismatch": "bg-red-100 text-red-700 border border-red-200 animate-pulse",
  Verified: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Flagged: "bg-red-100 text-red-700",
  Anomalous: "bg-red-100 text-red-700",
  Valid: "bg-emerald-100 text-emerald-700",
  "Tamper Alert": "bg-red-100 text-red-800 border border-red-300 animate-pulse",
  Sealed: "bg-blue-100 text-blue-700",
  "Hash Match": "bg-emerald-100 text-emerald-700",
  "Hash Mismatch": "bg-red-100 text-red-700",
  Disbursed: "bg-blue-100 text-blue-700",
  Liquidated: "bg-emerald-100 text-emerald-700",
  Returned: "bg-violet-100 text-violet-700",
  "In Transit": "bg-amber-100 text-amber-700",
};

export function Pill({ status }: { status: string }) {
  const style = pillMap[status] || "";
  const color = style.includes("red") ? "negative" : style.includes("amber") ? "working_orange" : style.includes("emerald") ? "positive" : style.includes("blue") ? "bright-blue" : style.includes("violet") ? "purple" : "dark";
  return <span aria-label={`Status: ${status}`} role="status"><Label color={color} text={status} /></span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Heading className="text-neutral-900" type="h1" weight="medium">{title}</Heading>
        <Text className="mt-1 text-neutral-500" type="text2">{subtitle || "Immutable Audit Review · Ormoc City LGU"}</Text>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}

export function Btn({ icon, label, variant = "secondary" }: { icon: React.ReactNode; label: string; variant?: "primary" | "secondary" | "danger" | "success" | "ghost" }) {
  const styles = { primary: { kind: "primary", color: "primary" }, secondary: { kind: "secondary", color: "primary" }, danger: { kind: "secondary", color: "negative" }, success: { kind: "primary", color: "positive" }, ghost: { kind: "tertiary", color: "primary" } } as const;
  return <Button color={styles[variant].color} kind={styles[variant].kind} size="small"><span aria-hidden="true" className="inline-flex">{icon}</span>{label}</Button>;
}

export function StatCard({ label, value, sub, trend, accent }: { label: string; value: string; sub?: string; trend?: "up" | "down" | "flat"; accent?: string }) {
  return (
    <section aria-label={label} className="min-w-[155px] flex-1 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]" data-accent={accent || undefined}>
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

// Monospace hash display
export function HashDisplay({ hash, full }: { hash: string; full?: boolean }) {
  return (
    <span className={`font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[11px] ${full ? "" : "tracking-tight"} text-neutral-600 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-100`}>
      {full ? hash : `${hash.slice(0, 6)}…${hash.slice(-4)}`}
    </span>
  );
}

// Green shield for verified integrity
export function IntegrityShield({ status }: { status: "verified" | "mismatch" | "checking" }) {
  if (status === "checking") {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex flex-col items-center gap-2">
          <Loader size="large" />
          <span className="text-[12px] font-medium text-blue-600">Re-computing hash from database row…</span>
        </div>
      </div>
    );
  }
  if (status === "mismatch") {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex flex-col items-center gap-3 rounded-[14px] border-2 border-red-300 bg-red-50 px-10 py-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <Warning size={32} className="text-red-600" />
          </div>
          <span className="text-[16px] font-semibold text-red-700">TAMPER DETECTED</span>
          <span className="text-[11px] font-normal text-red-600">Database hash ≠ Blockchain hash. Alert dispatched to Mayor.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center py-6">
      <div className="flex flex-col items-center gap-3 rounded-[14px] border-2 border-emerald-300 bg-emerald-50 px-10 py-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Security size={32} className="text-emerald-600" />
        </div>
        <span className="text-[16px] font-semibold text-emerald-700">INTEGRITY VERIFIED</span>
        <span className="text-[11px] font-normal text-emerald-600">Database row matches blockchain hash. No tampering detected.</span>
      </div>
    </div>
  );
}

// Read-only badge
export function ReadOnlyBanner() {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-[14px] border border-primary/20 bg-primary/5 px-4 py-2.5">
      <Locked size={16} className="text-primary" />
      <div><span className="ml-3 text-[11px] font-normal text-secondary-foreground">Read-only environment. All data is cryptographically sealed. No writes permitted.</span></div>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-[10px] font-medium text-emerald-700">Blockchain Sync </span>
      </div>
    </div>
  );
}

// ==================== MOCK DATA ====================

// Stable hashes generated once
