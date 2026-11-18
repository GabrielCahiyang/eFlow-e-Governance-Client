import type { ReactNode } from 'react';

export type InspectorSkeletonPresentation = 'drawer' | 'page' | 'dialog';

function InspectorBodyShimmer() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-6 w-3/5 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex gap-2 border-b border-border pb-3">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-8 w-20 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2.5 rounded-xl border border-border p-4">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-lg bg-muted/70" />
        </div>
        <div className="space-y-2.5 rounded-xl border border-border p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-lg bg-muted/70" />
        </div>
      </div>
      <div className="space-y-2.5 rounded-xl border border-border p-4">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-muted/70" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}

function StatusShell({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={className.includes('fixed') ? className : `relative ${className}`}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function InspectorSkeleton({
  presentation = 'drawer',
  label = 'Loading work details…',
}: {
  presentation?: InspectorSkeletonPresentation;
  label?: string;
}) {
  if (presentation === 'page') {
    return (
      <StatusShell
        label={label}
        className="rounded-xl border border-border bg-card p-5"
      >
        <InspectorBodyShimmer />
      </StatusShell>
    );
  }

  if (presentation === 'dialog') {
    return (
      <StatusShell
        label={label}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-xl">
          <InspectorBodyShimmer />
        </div>
      </StatusShell>
    );
  }

  return (
    <StatusShell
      label={label}
      className="fixed inset-0 z-50 flex justify-end bg-black/25"
    >
      <div className="h-full w-full max-w-xl overflow-hidden border-l border-border bg-card p-6 shadow-xl">
        <InspectorBodyShimmer />
      </div>
    </StatusShell>
  );
}

export function DialogSkeleton({
  label = 'Loading dialog…',
}: {
  label?: string;
}) {
  return (
    <StatusShell
      label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        aria-hidden="true"
        className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-44 animate-pulse rounded-md bg-muted" />
          <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/80" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/80" />
          <div className="h-20 w-full animate-pulse rounded-lg bg-muted/60" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </StatusShell>
  );
}

export function CardSectionSkeleton({
  rows = 2,
  label = 'Loading section…',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <StatusShell
      label={label}
      className="rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4"
    >
      <div aria-hidden="true" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="h-11 w-full animate-pulse rounded-lg bg-muted/70"
          />
        ))}
      </div>
    </StatusShell>
  );
}

export function InlineCellSkeleton({
  label = 'Loading…',
}: {
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-busy="true"
      aria-label={label}
      className="relative inline-block h-6 w-24 animate-pulse rounded-md bg-muted align-middle"
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
