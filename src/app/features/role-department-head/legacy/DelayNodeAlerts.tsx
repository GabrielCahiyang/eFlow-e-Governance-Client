import { useState } from "react";
import { Brain, MessageSquare, Target, TrendingUp } from "lucide-react";
import { Btn, PageHeader } from "./primitives";

type DelayNode = {
  id: string;
  name: string;
  officer: string;
  slaHours: number;
  actualHours: number;
  backlog: number;
  burnoutFlag: boolean;
  onLeave: boolean;
  trendDelta: number;
};

const DELAY_NODES: DelayNode[] = [
  {
    id: "d1",
    name: "Legal Review",
    officer: "Atty. Maria Reyes",
    slaHours: 72,
    actualHours: 288,
    backlog: 42,
    burnoutFlag: true,
    onLeave: false,
    trendDelta: 180,
  },
  {
    id: "d2",
    name: "Procurement Clearance",
    officer: "BAC Secretariat",
    slaHours: 120,
    actualHours: 144,
    backlog: 12,
    burnoutFlag: false,
    onLeave: false,
    trendDelta: 20,
  },
  {
    id: "d3",
    name: "Engineering QA",
    officer: "Engr. Cherry Lumapas",
    slaHours: 48,
    actualHours: 54,
    backlog: 6,
    burnoutFlag: false,
    onLeave: false,
    trendDelta: 12,
  },
];

export function DelayNodeAlerts() {
  const [selected, setSelected] = useState<DelayNode>(DELAY_NODES[0]);
  const overPct = (
    (selected.actualHours / selected.slaHours - 1) *
    100
  ).toFixed(0);

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Delay Node Diagnostic"
        subtitle="AI-identified SLA violations · cross-referenced with HRMO Burnout Radar"
        actions={
          <>
            <Btn icon={<MessageSquare size={13} />} label="Notify Officer" />
            <Btn
              icon={<Target size={13} />}
              label="Open Intervention Mandates"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-[0.9fr_1.4fr] gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 px-1 mb-1">
            Flagged Nodes
          </div>
          {DELAY_NODES.map((n) => {
            const isActive = selected.id === n.id;
            const severity = n.actualHours / n.slaHours;
            const tone =
              severity > 2
                ? {
                    border: "border-red-300",
                    bg: "bg-red-50",
                    chip: "bg-red-600 text-white",
                  }
                : severity > 1.2
                  ? {
                      border: "border-amber-300",
                      bg: "bg-amber-50",
                      chip: "bg-amber-500 text-white",
                    }
                  : {
                      border: "border-neutral-200",
                      bg: "bg-white",
                      chip: "bg-emerald-500 text-white",
                    };
            return (
              <button
                key={n.id}
                onClick={() => setSelected(n)}
                className={`w-full text-left border rounded-xl p-3 transition ${isActive ? "border-neutral-900 shadow-sm" : tone.border} ${tone.bg}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[12.5px] font-medium text-neutral-900">
                    {n.name}
                  </div>
                  <span
                    className={`text-[9px] font-medium uppercase rounded px-1.5 py-0.5 ${tone.chip}`}
                  >
                    {severity.toFixed(1)}× SLA
                  </span>
                </div>
                <div className="text-[10.5px] font-normal text-neutral-500">
                  {n.officer}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10.5px] font-normal text-neutral-600">
                  <span>
                    backlog:{" "}
                    <span className="font-medium text-neutral-900 tabular-nums">
                      {n.backlog}
                    </span>
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span className="flex items-center gap-0.5 text-red-700">
                    <TrendingUp size={10} /> +{n.trendDelta}h
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Diagnostic Panel
              </div>
              <div className="text-[17px] font-semibold text-neutral-900 mt-0.5">
                {selected.name}
              </div>
              <div className="text-[11.5px] font-normal text-neutral-500">
                Asapprovedicer · {selected.officer}
              </div>
            </div>
            <div className="bg-red-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                SLA Violation
              </div>
              <div className="text-[18px] font-semibold tabular-nums">
                +{overPct}%
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <Brain size={14} className="text-red-700 mt-0.5 shrink-0" />
              <div className="text-[11.5px] font-normal text-red-900 leading-relaxed">
                <span className="font-medium">
                  AI Insight.
                </span>{" "}
                This node is violating its {selected.slaHours}-hour Service
                Level Agreement. The backlog is currently{" "}
                <span className="font-medium">
                  {selected.backlog} documents
                </span>
                . The asapprovedicer{" "}
                {selected.burnoutFlag && (
                  <>
                    has been flagged by the{" "}
                    <span className="font-medium">
                      HR Burnout Radar
                    </span>{" "}
                    (78% sustained load over 14 days)
                  </>
                )}
                . Extrapolated clearance without intervention:{" "}
                <span className="font-medium">
                  21+ business days
                </span>
                .
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <div className="text-[9.5px] font-medium uppercase tracking-wider text-neutral-400">
                SLA Target
              </div>
              <div className="text-[16px] font-semibold text-neutral-900 tabular-nums mt-0.5">
                {selected.slaHours}h
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-[9.5px] font-medium uppercase tracking-wider text-red-600">
                Actual Avg.
              </div>
              <div className="text-[16px] font-semibold text-red-700 tabular-nums mt-0.5">
                {selected.actualHours}h
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-[9.5px] font-medium uppercase tracking-wider text-amber-700">
                Backlog
              </div>
              <div className="text-[16px] font-semibold text-amber-800 tabular-nums mt-0.5">
                {selected.backlog} docs
              </div>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 mb-2">
              Cross-Signal Correlation
            </div>
            <div className="space-y-1.5 text-[11.5px] font-normal text-neutral-700">
              {selected.burnoutFlag && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> HRMO
                  Burnout Radar · flagged 5 days ago
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{" "}
                Incoming volume up 38% MoM
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> No
                deputy currently configured for rerouting
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                Document quality score · nominal
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 16.1.C — INTERVENTION MANDATES ====================
