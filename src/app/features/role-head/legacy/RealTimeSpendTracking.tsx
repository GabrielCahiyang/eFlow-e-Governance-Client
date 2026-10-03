import { useState } from "react";
import { AlertOctagon, Download, Info } from "lucide-react";
import type { Task } from "../../../services/taskService";
import type { Employee } from "../../../services/employeeService";
import { Btn, PageHeader, Stat, peso, pesoShort } from "./primitives";

type BurndownProgram = {
  id: string;
  name: string;
  allocated: number;
  ideal: number[]; // ideal remaining by month (0..12)
  actual: number[]; // actual remaining by month (0..current)
  currentMonth: number;
  tone: "ok" | "warn" | "bad";
};

const BD_PROGRAMS: BurndownProgram[] = [
  {
    id: "bp1",
    name: "Coastal Road Rehabilitation",
    allocated: 10_000_000,
    ideal: [
      10_000_000, 9_167_000, 8_333_000, 7_500_000, 6_667_000, 5_833_000,
      5_000_000, 4_167_000, 3_333_000, 2_500_000, 1_667_000, 833_000, 0,
    ],
    actual: [10_000_000, 9_100_000, 7_800_000, 5_200_000],
    currentMonth: 3,
    tone: "bad",
  },
  {
    id: "bp2",
    name: "Eco-Park Phase 1",
    allocated: 8_000_000,
    ideal: [
      8_000_000, 7_333_000, 6_667_000, 6_000_000, 5_333_000, 4_667_000,
      4_000_000, 3_333_000, 2_667_000, 2_000_000, 1_333_000, 667_000, 0,
    ],
    actual: [8_000_000, 7_420_000, 6_720_000, 6_120_000],
    currentMonth: 3,
    tone: "ok",
  },
  {
    id: "bp3",
    name: "Drainage · District 4",
    allocated: 4_000_000,
    ideal: [
      4_000_000, 3_667_000, 3_333_000, 3_000_000, 2_667_000, 2_333_000,
      2_000_000, 1_667_000, 1_333_000, 1_000_000, 667_000, 333_000, 0,
    ],
    actual: [4_000_000, 3_900_000, 3_800_000, 3_720_000],
    currentMonth: 3,
    tone: "warn",
  },
];

function BurnDownChart({ prog }: { prog: BurndownProgram }) {
  const W = 420,
    H = 180,
    PADX = 38,
    PADY = 16;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const xFor = (m: number) => PADX + (m / 12) * (W - PADX - 10);
  const yFor = (v: number) => PADY + (1 - v / prog.allocated) * (H - PADY - 24);

  const idealPath = prog.ideal
    .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`)
    .join(" ");
  const actualPath = prog.actual
    .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`)
    .join(" ");
  const actualColor =
    prog.tone === "bad"
      ? "#dc2626"
      : prog.tone === "warn"
        ? "#f59e0b"
        : "#10b981";

  // Projected depletion month
  const burnRate =
    (prog.allocated - prog.actual[prog.actual.length - 1]) / prog.currentMonth;
  const monthsLeft = prog.actual[prog.actual.length - 1] / burnRate;
  const depletionMonthIdx = Math.min(
    11,
    Math.floor(prog.currentMonth + monthsLeft),
  );

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[12.5px] font-semibold text-neutral-900">
            {prog.name}
          </div>
          <div className="text-[10.5px] font-normal text-neutral-500">
            Allocated · {peso(prog.allocated)}
          </div>
        </div>
        <span
          className={`text-[9.5px] font-medium uppercase border rounded px-1.5 py-0.5 ${prog.tone === "bad" ? "text-red-700 bg-red-50 border-red-200" : prog.tone === "warn" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"}`}
        >
          {prog.tone === "bad"
            ? "Accelerated Burn"
            : prog.tone === "warn"
              ? "Slightly Ahead"
              : "On Pace"}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[180px]">
        {/* Y axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={PADX}
              y1={yFor(prog.allocated * (1 - f))}
              x2={W - 10}
              y2={yFor(prog.allocated * (1 - f))}
              stroke="#e5e5e5"
              strokeWidth="0.5"
              strokeDasharray="2 3"
            />
            <text
              x={PADX - 4}
              y={yFor(prog.allocated * (1 - f)) + 3}
              textAnchor="end"
              className="text-[8px] font-normal"
              fill="#a3a3a3"
            >
              {pesoShort(prog.allocated * (1 - f))}
            </text>
          </g>
        ))}
        {/* X labels */}
        {months.map((m, i) => (
          <text
            key={m}
            x={xFor(i)}
            y={H - 4}
            textAnchor="middle"
            className="text-[8px] font-normal"
            fill="#a3a3a3"
          >
            {m}
          </text>
        ))}
        {/* Ideal dotted */}
        <path
          d={idealPath}
          stroke="#94a3b8"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 3"
        />
        {/* Actual line */}
        <path
          d={actualPath}
          stroke={actualColor}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {prog.actual.map((v, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(v)} r="3" fill={actualColor} />
        ))}
        {/* Today marker */}
        <line
          x1={xFor(prog.currentMonth)}
          y1={PADY}
          x2={xFor(prog.currentMonth)}
          y2={H - 20}
          stroke="#171717"
          strokeWidth="1"
        />
        <text
          x={xFor(prog.currentMonth) + 2}
          y={PADY + 8}
          className="text-[8px] font-medium"
          fill="#171717"
        >
          Today
        </text>
        {prog.tone === "bad" && (
          <>
            <line
              x1={xFor(depletionMonthIdx)}
              y1={PADY}
              x2={xFor(depletionMonthIdx)}
              y2={H - 20}
              stroke="#dc2626"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <text
              x={xFor(depletionMonthIdx) + 2}
              y={PADY + 18}
              className="text-[8px] font-medium"
              fill="#dc2626"
            >
              Depleted · {months[depletionMonthIdx]}
            </text>
          </>
        )}
      </svg>

      {prog.tone === "bad" && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2">
          <AlertOctagon size={12} className="text-red-700 mt-0.5" />
          <div className="text-[10.5px] font-normal text-red-900 leading-relaxed">
            <span className="font-medium">
              AI Warning · Accelerated burn rate.
            </span>{" "}
            At current pacing, the {prog.name} budget will be depleted by{" "}
            <span className="font-medium">
              {months[depletionMonthIdx]}
            </span>
            , 4 months before year-end.
          </div>
        </div>
      )}
    </div>
  );
}

export function RealTimeSpendTracking({}: {
  tasks?: Task[];
  employees?: Employee[];
  departmentId?: string;
}) {
  const [quarter, setQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">("Q2");

  const totalAlloc = BD_PROGRAMS.reduce((s, p) => s + p.allocated, 0);
  const totalRemaining = BD_PROGRAMS.reduce(
    (s, p) => s + p.actual[p.actual.length - 1],
    0,
  );
  const burned = totalAlloc - totalRemaining;

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Q2 Budget Pacing · Burn-Down"
        subtitle="Agile financial graph · per-program burn vs. ideal timeline"
        actions={
          <>
            <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-0.5">
              {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuarter(q)}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-medium ${quarter === q ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
                >
                  {q}
                </button>
              ))}
            </div>
            <Btn
              icon={<Download size={13} />}
              label="Export: Departmental Spend Report"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Total Allocation"
          value={pesoShort(totalAlloc)}
          trend="CY 2026 · Engineering"
          tone="neutral"
        />
        <Stat
          label="Burned YTD"
          value={pesoShort(burned)}
          trend={`${((burned / totalAlloc) * 100).toFixed(0)}% of allocation`}
          tone="neutral"
        />
        <Stat
          label="Remaining"
          value={pesoShort(totalRemaining)}
          trend="Available for Q2–Q4"
          tone="good"
        />
        <Stat
          label="Programs Off-Pace"
          value={BD_PROGRAMS.filter((p) => p.tone !== "ok").length.toString()}
          trend="1 critical · 1 slow"
          tone="bad"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BD_PROGRAMS.map((p) => (
          <BurnDownChart key={p.id} prog={p} />
        ))}
      </div>

      <div className="mt-4 bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={14} className="text-neutral-600 mt-0.5 shrink-0" />
        <div className="text-[11.5px] font-normal text-neutral-700 leading-relaxed">
          <span className="font-medium text-neutral-900">
            Reading the chart:
          </span>{" "}
          the dashed gray line is the ideal burn (straight diagonal from full
          allocation on Jan 1 to ₱0 on Dec 31). The solid colored line is your
          actual remaining balance month-by-month. If the solid line dives below
          the dashed line, you are overspending; the system projects your
          depletion date.
        </div>
      </div>
    </div>
  );
}

// ==================== 18.1.B — OVERRUN PREVENTION ====================
