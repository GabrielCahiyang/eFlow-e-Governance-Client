import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
// Shared workflow composition contracts. These keep the existing public API
// while delegating controls, states, typography, and progress to Vibe.

import {
  Button,
  EmptyState,
  Heading,
  Loader,
  ProgressBar as VibeProgressBar,
  Search as VibeSearch,
  Text,
} from "@vibe/core";
import { Download, PDF, Warning } from "@vibe/icons";
import React from "react";

// ─── PageHeader ──────────────────────────────────────────────────
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <Text
            className="mb-1 inline-flex items-center gap-1.5 uppercase tracking-[0.08em] text-primary"
            type="text3"
            weight="medium"
          >
            {eyebrow}
          </Text>
        )}
        <Heading
          className="!overflow-visible !text-clip !whitespace-normal !text-[32px] !leading-[38px] break-words text-foreground"
          type="h1"
          weight="bold"
        >
          {title}
        </Heading>
        {subtitle && (
          <Text
            className="mt-2 max-w-3xl !overflow-visible !text-clip !whitespace-normal break-words text-secondary-foreground"
            type="text2"
          >
            {subtitle}
          </Text>
        )}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}

// ─── SectionHeading ─────────────────────────────────────────────
// A compact heading for a card or form section. Feature modules use this
// instead of carrying their own card-heading typography and icon treatment.
export function SectionHeading({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <Text
          className="uppercase tracking-[0.12em] text-primary"
          type="text3"
          weight="medium"
        >
          {eyebrow}
        </Text>
        <Heading className="mt-0.5 text-foreground" type="h3" weight="bold">
          {title}
        </Heading>
        {description && (
          <Text className="mt-1 leading-5 text-muted-foreground" type="text3">
            {description}
          </Text>
        )}
      </div>
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────
export function WButton({
  icon,
  children,
  variant = "secondary",
  onClick,
  disabled,
  type = "button",
  className = "",
  size = "medium",
}: {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  size?: "small" | "medium" | "large";
}) {
  const presentation = {
    primary: { kind: "primary", color: "primary" },
    secondary: { kind: "secondary", color: "primary" },
    danger: { kind: "secondary", color: "negative" },
    success: { kind: "primary", color: "positive" },
    ghost: { kind: "tertiary", color: "primary" },
  } as const;
  const selected = presentation[variant];
  return (
    <Button
      className={`eflow-workflow-button ${className}`}
      color={selected.color}
      disabled={disabled}
      kind={selected.kind}
      onClick={() => onClick?.()}
      size={size}
      type={type}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      )}
      {children}
    </Button>
  );
}

function StatCardContent({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone: "neutral" | "good" | "warn" | "bad" | "info";
  icon?: React.ReactNode;
}) {
  const toneMap: Record<typeof tone, string> = {
    neutral: "text-foreground",
    good: "text-[#198754]",
    warn: "text-[#b65b08]",
    bad: "text-destructive",
    info: "text-[#2767a7]",
  };
  const iconTone: Record<typeof tone, string> = {
    neutral: "bg-muted text-secondary-foreground",
    good: "bg-[#e7f5ec] text-[#198754]",
    warn: "bg-[#fff1df] text-[#b65b08]",
    bad: "bg-destructive/10 text-destructive",
    info: "bg-[#e8f0f8] text-[#2767a7]",
  };
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Text
          className="min-w-0 break-words !overflow-visible !text-clip !whitespace-normal uppercase tracking-[0.08em] text-muted-foreground"
          type="text3"
          weight="medium"
        >
          {label}
        </Text>
        {icon && (
          <span
            aria-hidden="true"
            className={`grid size-8 shrink-0 place-items-center rounded-md ${iconTone[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className={`eflow-tabular mt-1 text-2xl font-semibold ${toneMap[tone]}`}
      >
        {value}
      </div>
      {hint && (
        <Text className="mt-1 text-muted-foreground" type="text3">
          {hint}
        </Text>
      )}
    </>
  );
}

// ─── StatCard ────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const classes = `w-full rounded-[10px] border bg-card p-5 text-left shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] transition-[border-color,box-shadow] duration-120 ${
    active ? "border-primary ring-2 ring-primary/20" : "border-border"
  }`;
  const content = (
    <StatCardContent
      icon={icon}
      hint={hint}
      label={label}
      tone={tone}
      value={value}
    />
  );
  return onClick ? (
    <button
      aria-pressed={active}
      type="button"
      onClick={onClick}
      className={`${classes} cursor-pointer hover:border-[#b9c6c5] hover:shadow-[0_4px_8px_rgba(0,0,0,0.20)]`}
    >
      {content}
    </button>
  ) : (
    <section aria-label={label} className={classes}>
      {content}
    </section>
  );
}

// ─── Card ────────────────────────────────────────────────────────
export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            {title && (
              <Heading className="text-foreground" type="h3" weight="bold">
                {title}
              </Heading>
            )}
            {subtitle && (
              <Text className="mt-0.5 text-muted-foreground" type="text3">
                {subtitle}
              </Text>
            )}
          </div>
          {right}
        </div>
      )}
      <div className={bodyClassName || "p-5"}>{children}</div>
    </section>
  );
}

// ─── SearchInput ─────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <VibeSearch
      className={className}
      clearIconLabel="Clear search"
      inputAriaLabel={placeholder}
      onChange={onChange}
      onClear={() => onChange("")}
      placeholder={placeholder}
      showClearIcon
      size="small"
      value={value}
    />
  );
}

// ─── Select ──────────────────────────────────────────────────────
export function WSelect({
  value,
  onChange,
  options,
  className = "",
  ariaLabel = "Filter options",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  const key = (option: string) => "option:" + encodeURIComponent(option);
  return (
    <Select
      value={key(value)}
      onValueChange={(next) => onChange(decodeURIComponent(next.slice(7)))}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={`eflow-workflow-select h-9 min-w-[140px] ${className}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={key(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── FilterBar ───────────────────────────────────────────────────
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-card p-3">
      {children}
    </div>
  );
}

// ─── ExportMenu ──────────────────────────────────────────────────
// Consistent CSV/PDF export cluster. Callers wire the two handlers to
// reportService.exportCsv / exportPdf with their filtered rows.
export function ExportMenu({
  onCsv,
  onPdf,
  disabled,
}: {
  onCsv: () => void;
  onPdf: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      aria-label="Export report"
      className="inline-flex items-center gap-1"
      role="group"
    >
      <Button
        color="primary"
        disabled={disabled}
        kind="secondary"
        leftIcon={PDF}
        onClick={onPdf}
        size="small"
      >
        PDF
      </Button>
      <Button
        color="primary"
        disabled={disabled}
        kind="secondary"
        leftIcon={Download}
        onClick={onCsv}
        size="small"
      >
        CSV
      </Button>
    </div>
  );
}

// ─── Section states ──────────────────────────────────────────────
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground"
      role="status"
    >
      <Loader size="medium" />
      <Text type="text2">{label}</Text>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      role="alert"
    >
      <EmptyState
        description={message || "We couldn't load this data. Please try again."}
        title="Something went wrong"
        visual={<Warning aria-hidden="true" size={32} />}
      />
      {onRetry && <WButton onClick={onRetry}>Retry</WButton>}
    </div>
  );
}

export function SectionEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <EmptyState
        description={description || title}
        layout="compact"
        title={description ? title : undefined}
        visual={
          icon && (
            <span aria-hidden="true" className="text-muted-foreground">
              {icon}
            </span>
          )
        }
      />
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Progress bar ────────────────────────────────────────────────
export function ProgressBar({
  value,
  tone = "neutral",
}: {
  value: number;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const map = {
    neutral: "primary",
    good: "positive",
    warn: "warning",
    bad: "negative",
  } as const;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={`${Math.round(pct)}% complete`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div aria-hidden="true">
        <VibeProgressBar
          aria-label={`${Math.round(pct)}% complete`}
          animated={false}
          barStyle={map[tone]}
          fullWidth
          max={100}
          min={0}
          size="small"
          value={pct}
        />
      </div>
    </div>
  );
}

// ─── Formatting helpers ──────────────────────────────────────────
export function formatDate(d?: string | number | null): string {
  if (!d) return "—";
  if (typeof d === "string" && /month|phase|week/i.test(d)) return d;
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeDays(d?: string | number | null): {
  label: string;
  overdue: boolean;
} {
  if (!d) return { label: "No deadline", overdue: false };
  if (typeof d === "string" && /month|phase|week/i.test(d))
    return { label: d, overdue: false };
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  if (isNaN(date.getTime())) return { label: "No deadline", overdue: false };
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: "Due today", overdue: false };
  if (days === 1) return { label: "Due tomorrow", overdue: false };
  return { label: `${days}d left`, overdue: false };
}
