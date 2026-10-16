import { useEffect, useMemo, useRef, useState } from "react";
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
        className={`inline-flex items-center max-sm:!h-11 rounded-xl border border-border bg-card text-card-foreground shadow-sm ${compact ? "h-9" : "h-10"}`}
        aria-label="Fiscal year control"
      >
        <button
          type="button"
          aria-label={`Open fiscal year ${value - 1}`}
          onClick={() => onChange(value - 1)}
          className="flex h-full w-9 max-sm:min-w-11 items-center justify-center rounded-l-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          onClick={() => setOpen((shown) => !shown)}
          className="flex h-full min-w-[145px] items-center justify-center gap-2 border-x border-border px-3 text-left"
        >
          <CalendarRange size={13} className="text-primary" />
          <span className="flex-1">
            <span className="block text-[10px] uppercase tracking-[.14em] text-muted-foreground">
              Fiscal year
            </span>
            <span className="block text-[12px] font-semibold leading-none text-foreground">
              FY {value}{value === current ? " · Current" : ""}
            </span>
          </span>
          <ChevronDown
            size={12}
            className={`text-muted-foreground transition ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          aria-label={`Open fiscal year ${value + 1}`}
          onClick={() => onChange(value + 1)}
          className="flex h-full w-9 max-sm:min-w-11 items-center justify-center rounded-r-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-[calc(100%+.45rem)] z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground p-1.5 shadow-xl">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-[.14em] text-muted-foreground">
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
                className="flex w-full max-sm:min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted"
              >
                <span className="flex-1">
                  <span className="block text-[12px] font-medium">
                    FY {year}{year === current ? " · Current" : ""}
                  </span>
                  <span className="mt-0.5 block text-[11px] capitalize text-muted-foreground">
                    {option
                      ? `${option.status} · ${peso.format(option.amount)}`
                      : year > current
                        ? "Available for setup"
                        : "Not configured"}
                  </span>
                </span>
                {year === value && <Check size={13} className="text-primary" />}
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
              className="mt-1 w-full rounded-lg bg-primary px-3 py-2 text-[12px] text-primary-foreground transition hover:bg-primary/90"
            >
              Return to current FY
            </button>
          )}
        </div>
      )}
    </div>
  );
}
