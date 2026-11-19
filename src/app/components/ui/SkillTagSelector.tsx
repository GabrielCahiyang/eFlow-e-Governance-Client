import { useMemo, useState } from "react";
import { Check, Search, Tag } from "lucide-react";

export interface SkillTagSelectorProps {
  availableTags: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
  showSearchThreshold?: number;
  variant?: "default" | "checklist";
}

export function skillMapToList(skills: Record<string, boolean> | undefined | null): string[] {
  if (!skills) return [];
  return Object.entries(skills)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);
}

export function skillListToMap(skills: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(skills.map((skill) => [skill, true]));
}

export function SkillTagSelector({
  availableTags,
  selected,
  onChange,
  disabled = false,
  loading = false,
  title = "Skills",
  description = "Select all skills that apply.",
  emptyMessage = "No skill tags are configured yet. Ask Admin to add skill tags.",
  showSearchThreshold = 14,
  variant = "default",
}: SkillTagSelectorProps) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Preserve previously assigned custom/retired tags alongside active catalog tags.
  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    const combined: string[] = [];
    for (const tag of availableTags) {
      const clean = tag.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        combined.push(clean);
      }
    }
    for (const tag of selected) {
      const clean = tag.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        combined.push(clean);
      }
    }
    return combined;
  }, [availableTags, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allOptions.filter((tag) => tag.toLowerCase().includes(q)) : allOptions;
  }, [allOptions, query]);

  const toggle = (tag: string) => {
    if (disabled) return;
    if (selectedSet.has(tag)) {
      onChange(selected.filter((item) => item !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--eflow-text,#111827)]">
            <Tag size={14} aria-hidden="true" />
            {title}
          </span>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--eflow-text-muted,#6b7280)]">
              {description}
            </p>
          )}
        </div>
        {selected.length > 0 && (
          <span className="text-xs font-medium text-[var(--eflow-accent-text,#0b5b58)] tabular-nums">
            {selected.length} selected
          </span>
        )}
      </div>

      {allOptions.length > showSearchThreshold && (
        <div className="relative">
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--eflow-text-muted,#6b7280)]"
          />
          <input
            type="search"
            value={query}
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter skill tags…"
            maxLength={120}
            aria-label="Filter skill tags"
            className="h-9 w-full rounded-lg border border-[var(--eflow-border,#e5e7eb)] bg-[var(--eflow-surface,#ffffff)] pl-8 pr-3 text-xs text-[var(--eflow-text,#111827)] placeholder:text-[var(--eflow-text-muted,#6b7280)]"
          />
        </div>
      )}

      {loading ? (
        <p role="status" className="text-xs text-[var(--eflow-text-muted,#6b7280)]">
          Loading skill tags…
        </p>
      ) : allOptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--eflow-border,#e5e7eb)] px-3 py-4 text-center text-xs text-[var(--eflow-text-muted,#6b7280)]">
          {emptyMessage}
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[var(--eflow-text-muted,#6b7280)]">
          No skill tags match “{query.trim()}”.
        </p>
      ) : (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={title}
        >
          {filtered.map((tag) => {
            const active = selectedSet.has(tag);
            const retiredLegacy = !availableTags.includes(tag);
            if (variant === "checklist") {
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => toggle(tag)}
                  className={`inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-[#0073ea] bg-[#f4f9ff] text-[#161b35]"
                      : "border-[#d6deed] bg-[#ffffff] text-[#323a4d] hover:border-[#9eb4d6] hover:bg-[#f8faff]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                      active
                        ? "border-[#0073ea] bg-[#0073ea] text-white"
                        : "border-[#c4cddf] bg-white"
                    }`}
                  >
                    {active && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span>{tag}</span>
                  {retiredLegacy && (
                    <span className="text-[10px] opacity-70">(custom)</span>
                  )}
                </button>
              );
            }
            return (
              <button
                key={tag}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => toggle(tag)}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-[var(--eflow-accent,#087f8c)] bg-[var(--eflow-accent-soft,rgba(8,127,140,0.12))] text-[var(--eflow-accent-text,#0b5b58)]"
                    : "border-[var(--eflow-border,#e5e7eb)] bg-[var(--eflow-surface,#ffffff)] text-[var(--eflow-text,#111827)] hover:bg-[var(--eflow-hover,#f3f4f6)]"
                }`}
              >
                {active && <Check size={13} aria-hidden="true" />}
                <span>{tag}</span>
                {retiredLegacy && (
                  <span className="text-[10px] opacity-70">(custom)</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
