import type { ReactNode } from "react";
import { Briefcase } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-400">
          <Briefcase size={12} /> Dept. Head · Command Center
        </div>
        <h1 className="text-[22px] font-semibold text-neutral-900">{title}</h1>
        <p className="mt-0.5 text-[13px] text-neutral-500">
          {subtitle || "Office of the City Engineer · Ormoc City"}
        </p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

export function Btn({
  icon,
  label,
  variant = "secondary",
  onClick,
  disabled,
}: {
  icon?: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "success";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const variants = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-800",
    secondary: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
    danger: "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${variants[variant]} ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      {icon}
      {label}
    </button>
  );
}

export function Stat({
  label,
  value,
  trend,
  tone = "neutral",
}: {
  label: string;
  value: string;
  trend?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "text-neutral-900",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
  };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</div>
      <div className={`mt-1 text-[22px] font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
      {trend && <div className="mt-0.5 text-[11px] text-neutral-500">{trend}</div>}
    </div>
  );
}

export const peso = (value: number, decimals = 0) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const pesoShort = (value: number) => {
  if (value >= 1_000_000_000) return `₱${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}K`;
  return `₱${value}`;
};
