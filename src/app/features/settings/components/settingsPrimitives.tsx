import type { ReactNode } from 'react';
import { AttentionBox } from '@vibe/core';
import {
  Card as WorkflowCard,
  LoadingState,
  SectionHeading as WorkflowSectionHeading,
} from '../../../components/workflow/primitives';

export type Result = { tone: 'success' | 'error'; text: string } | null;

export const inputClass = 'h-11 rounded-lg border-neutral-200 bg-white px-3.5 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

export function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ResultMessage({ result }: { result: Result }) {
  if (!result) return null;
  return <AttentionBox animate={false} className="mt-3" compact text={result.text} type={result.tone === 'success' ? 'positive' : 'negative'} />;
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <WorkflowCard bodyClassName="contents" className={className}>{children}</WorkflowCard>;
}

export function SectionHeading({ icon, eyebrow, title, description }: { icon: ReactNode; eyebrow: string; title: string; description: string }) {
  return <WorkflowSectionHeading description={description} eyebrow={eyebrow} icon={icon} title={title} />;
}

export function IdentityItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-3.5 sm:px-4 first:pl-0 last:pr-0">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-slate-900 dark:text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-neutral-400 dark:text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

export function SettingsLoading({ label }: { label: string }) {
  return <div className="min-h-72"><LoadingState label={label} /></div>;
}
