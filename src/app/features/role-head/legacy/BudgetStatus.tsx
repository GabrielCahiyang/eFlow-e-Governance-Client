import { Info, TrendingUp, Wallet } from "lucide-react";
import { Btn, PageHeader, Stat, pesoShort } from "./primitives";

type BurnProject = {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  month: number;
  total: number;
};

const BURN_PROJECTS: BurnProject[] = [
  {
    id: "b1",
    name: "Eco-Park Phase 1",
    allocated: 50_000_000,
    spent: 29_000_000,
    month: 4,
    total: 12,
  },
  {
    id: "b2",
    name: "Coastal Road Rehab",
    allocated: 180_000_000,
    spent: 128_000_000,
    month: 4,
    total: 12,
  },
  {
    id: "b3",
    name: "Drainage · Dist. 4",
    allocated: 22_000_000,
    spent: 6_100_000,
    month: 4,
    total: 12,
  },
  {
    id: "b4",
    name: "Public Market Retrofit",
    allocated: 38_000_000,
    spent: 26_200_000,
    month: 4,
    total: 12,
  },
  {
    id: "b5",
    name: "Fire Station Annex",
    allocated: 18_000_000,
    spent: 9_400_000,
    month: 4,
    total: 12,
  },
  {
    id: "b6",
    name: "Equipment Pool · 2026",
    allocated: 12_000_000,
    spent: 3_100_000,
    month: 4,
    total: 12,
  },
];

function BurnGauge({ project }: { project: BurnProject }) {
  const spentPct = (project.spent / project.allocated) * 100;
  const timePct = (project.month / project.total) * 100;
  const delta = spentPct - timePct;
  const over = delta > 10;
  const under = delta < -10;

  const tone = over
    ? {
        arc: "stroke-red-500",
        chip: "text-red-700 bg-red-50 border-red-200",
        label: "Over-burning",
      }
    : under
      ? {
          arc: "stroke-amber-500",
          chip: "text-amber-700 bg-amber-50 border-amber-200",
          label: "Under-utilized",
        }
      : {
          arc: "stroke-emerald-500",
          chip: "text-emerald-700 bg-emerald-50 border-emerald-200",
          label: "Paced",
        };

  const R = 38;
  const C = 2 * Math.PI * R;
  const spentDash = (spentPct / 100) * C;
  const timeDash = (timePct / 100) * C;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12.5px] font-medium text-neutral-900 truncate pr-2">
          {project.name}
        </div>
        <span
          className={`text-[9.5px] font-medium uppercase border rounded px-1.5 py-0.5 shrink-0 ${tone.chip}`}
        >
          {tone.label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-[100px] h-[100px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              className="stroke-neutral-100"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              className="stroke-neutral-300"
              strokeWidth="8"
              strokeDasharray={`${timeDash} ${C - timeDash}`}
              strokeLinecap="round"
              opacity="0.4"
            />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              className={tone.arc}
              strokeWidth="8"
              strokeDasharray={`${spentDash} ${C - spentDash}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[17px] font-semibold text-neutral-900 tabular-nums leading-none">
              {spentPct.toFixed(0)}%
            </div>
            <div className="text-[9px] font-normal text-neutral-500 mt-0.5">
              burned
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5 text-[10.5px] font-normal">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Allocated</span>
            <span className="text-neutral-900 tabular-nums">
              {pesoShort(project.allocated)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Spent YTD</span>
            <span className="text-neutral-900 tabular-nums">
              {pesoShort(project.spent)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Time Elapsed</span>
            <span className="text-neutral-900 tabular-nums">
              {timePct.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
            <span className="text-neutral-500">Δ vs. pace</span>
            <span
              className={`tabular-nums font-medium ${over ? "text-red-700" : under ? "text-amber-700" : "text-emerald-700"}`}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}pp
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BudgetStatus() {
  const totalAlloc = BURN_PROJECTS.reduce((s, p) => s + p.allocated, 0);
  const totalSpent = BURN_PROJECTS.reduce((s, p) => s + p.spent, 0);
  const pct = (totalSpent / totalAlloc) * 100;

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Departmental Wallet"
        subtitle="Burn-rate gauges · Prevents December reversion to National Treasury"
        actions={
          <>
            <Btn icon={<Wallet size={13} />} label="Request Realignment" />
            <Btn
              icon={<TrendingUp size={13} />}
              label="Forecast to Dec 31"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Annual Allocation"
          value={pesoShort(totalAlloc)}
          trend="CY 2026 · Engineering"
          tone="neutral"
        />
        <Stat
          label="Burned YTD"
          value={pesoShort(totalSpent)}
          trend={`${pct.toFixed(0)}% of allocation`}
          tone="neutral"
        />
        <Stat
          label="Pace Target"
          value="33%"
          trend="April = month 4 of 12"
          tone="neutral"
        />
        <Stat
          label="Reversion Risk"
          value="Low"
          trend="On pace · no December scramble"
          tone="good"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {BURN_PROJECTS.map((p) => (
          <BurnGauge key={p.id} project={p} />
        ))}
      </div>

      <div className="mt-5 bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={14} className="text-neutral-600 mt-0.5 shrink-0" />
        <div className="text-[11.5px] font-normal text-neutral-600 leading-relaxed">
          <span className="font-medium text-neutral-900">
            Reading the gauge:
          </span>{" "}
          the faint gray arc is the expected pace for today (month 4 of 12 =
          33%). The colored arc is actual spend.{" "}
          <span className="text-emerald-700 font-medium">
            Paced
          </span>{" "}
          means spend ≈ time.{" "}
          <span className="text-red-700 font-medium">
            Over-burning
          </span>{" "}
          risks running dry by Q3.{" "}
          <span className="text-amber-700 font-medium">
            Under-utilized
          </span>{" "}
          risks the December scramble that forces unspent allotments back to the
          National Treasury.
        </div>
      </div>
    </div>
  );
}

// ==================== 15.1.C — TIMELINE REVIEW ====================
