import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchDepartmentFiscalYears } from "../services/budgetService";
import { getCurrentFiscalYear } from "../constants";
import { peso } from "./budgetUi";
import { useAuth } from "../../../contexts/AuthContext";

export function FiscalYearControl({ value, onChange, compact = false, orgId }: { value: number; onChange: (year: number) => void; compact?: boolean; orgId?: string }) {
  const { userProfile } = useAuth();
  const resolvedOrgId = orgId || userProfile?.org_id || userProfile?.departmentId || "";
  const current = getCurrentFiscalYear();
  const [configured, setConfigured] = useState<Array<{ year: number; status: string; amount: number }>>([]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!resolvedOrgId) return; void fetchDepartmentFiscalYears(resolvedOrgId).then(setConfigured).catch(() => setConfigured([])); }, [resolvedOrgId]);
  useEffect(() => { const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  const years = useMemo(() => Array.from(new Set([...configured.map((item) => item.year), current, current + 1, value])).sort((a, b) => b - a), [configured, current, value]);
  return (
    <div ref={root} className="relative">
      <div
        className={`inline-flex items-center max-sm:!h-11 rounded-[8px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] text-[var(--eflow-text)] ${compact ? "h-9" : "h-10"}`}
        aria-label="Fiscal year control"
      >
        <WorkspaceTooltip content="Previous fiscal year"><button
          type="button"
          aria-label={`Open fiscal year ${value - 1}`}
          onClick={() => onChange(value - 1)}
          className="flex h-full w-9 max-sm:min-w-11 items-center justify-center rounded-l-[8px] text-[var(--eflow-text-muted)] transition hover:bg-[var(--eflow-subtle)] hover:text-[var(--eflow-text)]"
        >
          <ChevronLeft size={14} />
        </button></WorkspaceTooltip>
        <button
          type="button"
          onClick={() => setOpen((shown) => !shown)}
          aria-expanded={open}
          className="flex h-full min-w-[158px] items-center justify-center gap-2 border-x border-[var(--eflow-border)] px-3 text-left whitespace-nowrap transition hover:bg-[var(--eflow-subtle)]"
        >
          <CalendarRange size={14} className="shrink-0 text-[var(--eflow-primary)]" />
          <span className="flex-1 text-[13px] font-semibold leading-none text-[var(--eflow-text)]">
            FY {value}{value === current ? " · Current" : ""}
          </span>
          <ChevronDown
            size={13}
            className={`shrink-0 text-[var(--eflow-text-muted)] transition ${open ? "rotate-180" : ""}`}
          />
        </button>
        <WorkspaceTooltip content="Next fiscal year"><button
          type="button"
          aria-label={`Open fiscal year ${value + 1}`}
          onClick={() => onChange(value + 1)}
          className="flex h-full w-9 max-sm:min-w-11 items-center justify-center rounded-r-[8px] text-[var(--eflow-text-muted)] transition hover:bg-[var(--eflow-subtle)] hover:text-[var(--eflow-text)]"
        >
          <ChevronRight size={14} />
        </button></WorkspaceTooltip>
      </div>

      {open && (
        <div className="absolute right-0 top-[calc(100%+.45rem)] z-50 w-64 overflow-hidden rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] text-[var(--eflow-text)] p-1.5 shadow-xl">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--eflow-text-muted)]">
            Configured fiscal years
          </div>
          {years.map((year) => {
            const option = configured.find((item) => item.year === year);
            return (
              <button
                key={year}
                type="button"
                onClick={() => {
                  onChange(year);
                  setOpen(false);
                }}
                className="flex w-full max-sm:min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--eflow-subtle)]"
              >
                <span className="flex-1">
                  <span className="block text-[12px] font-medium">
                    FY {year}{year === current ? " · Current" : ""}
                  </span>
                  <span className="mt-0.5 block text-[11px] capitalize text-[var(--eflow-text-muted)]">
                    {option
                      ? `${option.status} · ${peso.format(option.amount)}`
                      : year > current
                        ? "Available for setup"
                        : "Not configured"}
                  </span>
                </span>
                {year === value && <Check size={13} className="text-[var(--eflow-primary)]" />}
              </button>
            );
          })}
          {value !== current && (
            <button
              type="button"
              onClick={() => {
                onChange(current);
                setOpen(false);
              }}
              className="mt-1 w-full rounded-lg bg-[var(--eflow-primary)] px-3 py-2 text-[12px] text-[var(--eflow-on-primary)] transition hover:bg-[var(--eflow-primary-hover)]"
            >
              Return to current FY
            </button>
          )}
        </div>
      )}
    </div>
  );
}
