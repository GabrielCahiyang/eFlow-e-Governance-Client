import { Check, Lock } from 'lucide-react';

type Choice = { id: string; title: string; status: string };

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  completed: {
    label: 'Completed',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  in_progress: {
    label: 'In progress',
    tone: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-300',
  },
  for_review: {
    label: 'For review',
    tone: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300',
  },
  pending_assignment: {
    label: 'Pending assignment',
    tone: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
  },
  todo: {
    label: 'To do',
    tone: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
  },
  cancelled: {
    label: 'Cancelled · remove or replace',
    tone: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300',
  },
};

function formatChoiceStatus(status: string) {
  return STATUS_LABELS[status] ?? {
    label: status.replace(/_/g, ' ').replace(/^\w/, char => char.toUpperCase()),
    tone: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
  };
}

export function PrerequisiteField({ label, choices, selected, disabled, onChange }: {
  label: string;
  choices: readonly Choice[];
  selected: readonly string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const unavailable = selected.some(id => !choices.some(choice => choice.id === id));
  const isLocked = Boolean(disabled || unavailable);

  return (
    <fieldset aria-label={label} disabled={isLocked} className="m-0 min-w-0 space-y-2 border-0 p-0">
      <legend className="text-[13px] font-medium text-[var(--eflow-text,#161b35)]">{label}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--eflow-text-muted,#5e6b85)]">
        <span>
          {selected.length > 0
            ? `${selected.length} ${selected.length === 1 ? 'prerequisite' : 'prerequisites'} selected`
            : isLocked
              ? 'No prerequisites selected'
              : 'Select prerequisites that must finish first'}
        </span>
        {isLocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--eflow-subtle,#f0f4fb)] px-2 py-0.5 text-[11px] font-medium text-[var(--eflow-text-secondary,#505c77)]">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Read-only
          </span>
        )}
      </div>
      {unavailable && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          Some prerequisites are unavailable. The selection is read-only.
        </p>
      )}
      {choices.length === 0 && !unavailable && (
        <p className="rounded-xl border border-dashed border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f8fafc)] px-3.5 py-3 text-[12.5px] text-[var(--eflow-text-muted,#5e6b85)]">
          No eligible prerequisites yet.
        </p>
      )}
      {choices.length > 0 && (
        <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f8fafc)] p-2">
          {choices.map(choice => {
            const isSelected = selected.includes(choice.id);
            const statusMeta = formatChoiceStatus(choice.status);
            return (
              <label
                key={choice.id}
                className={[
                  '!m-0 !flex items-center justify-between !gap-3 rounded-lg border px-3 py-2.5 text-[13px] transition-colors',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-[#087972]/40',
                  isSelected
                    ? 'border-[#087972]/60 bg-[#eef8f6] text-[#103834] dark:border-teal-500/60 dark:bg-teal-950/40 dark:text-teal-100'
                    : 'border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#ffffff)] text-[var(--eflow-text,#161b35)]',
                  isLocked
                    ? 'cursor-not-allowed opacity-75'
                    : isSelected
                      ? 'cursor-pointer hover:border-[#087972] hover:bg-[#e5f4f1] dark:hover:bg-teal-950/60'
                      : 'cursor-pointer hover:border-[#087972]/45 hover:bg-[#f7fbfa] dark:hover:bg-slate-800/60',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isSelected}
                  onChange={event =>
                    onChange(
                      event.target.checked
                        ? [...selected, choice.id]
                        : selected.filter(id => id !== choice.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                  {choice.title}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight ${statusMeta.tone}`}>
                    {statusMeta.label}
                  </span>
                  {isSelected && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#087972] text-white" aria-hidden="true">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
