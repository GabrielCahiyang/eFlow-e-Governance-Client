import { useMemo, useState } from "react";
import { Activity, Filter, GitBranch } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

type FlowNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  slaHours: number;
  actualHours: number;
  inQueue: number;
  officer?: string;
};

type FlowEdge = { from: string; to: string };

const FLOW_NODES: FlowNode[] = [
  {
    id: "n1",
    label: "Site Survey",
    x: 60,
    y: 120,
    slaHours: 24,
    actualHours: 22,
    inQueue: 3,
    officer: "Survey Team",
  },
  {
    id: "n2",
    label: "Cost Estimate",
    x: 230,
    y: 120,
    slaHours: 48,
    actualHours: 46,
    inQueue: 8,
    officer: "Budget Officer",
  },
  {
    id: "n3",
    label: "Legal Review",
    x: 400,
    y: 120,
    slaHours: 72,
    actualHours: 288,
    inQueue: 42,
    officer: "Atty. Reyes",
  },
  {
    id: "n4",
    label: "Procurement",
    x: 570,
    y: 60,
    slaHours: 120,
    actualHours: 144,
    inQueue: 12,
    officer: "BAC Secretariat",
  },
  {
    id: "n5",
    label: "Engineering QA",
    x: 570,
    y: 180,
    slaHours: 48,
    actualHours: 54,
    inQueue: 6,
    officer: "QA Team",
  },
  {
    id: "n6",
    label: "Execution",
    x: 740,
    y: 120,
    slaHours: 0,
    actualHours: 0,
    inQueue: 0,
    officer: "Field Crew",
  },
];

const FLOW_EDGES: FlowEdge[] = [
  { from: "n1", to: "n2" },
  { from: "n2", to: "n3" },
  { from: "n3", to: "n4" },
  { from: "n3", to: "n5" },
  { from: "n4", to: "n6" },
  { from: "n5", to: "n6" },
];

function edgeTone(_fromNode: FlowNode, toNode: FlowNode) {
  const ratio =
    toNode.slaHours === 0 ? 1 : toNode.actualHours / toNode.slaHours;
  if (ratio > 2)
    return { stroke: "#dc2626", width: 6, pulse: true, label: "Critical" };
  if (ratio > 1.2)
    return { stroke: "#f59e0b", width: 4, pulse: false, label: "Delayed" };
  return { stroke: "#10b981", width: 2, pulse: false, label: "On SLA" };
}

export function ProcessMiningGraphs() {
  const [highlight, setHighlight] = useState(false);
  const nodeById = useMemo(
    () => Object.fromEntries(FLOW_NODES.map((n) => [n.id, n])),
    [],
  );

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Live Workflow Topology"
        subtitle="Process-mined from BPA timestamps · Standard Infrastructure SOP"
        actions={
          <>
            <Btn
              icon={<Filter size={13} />}
              label="Highlight Delays"
              onClick={() => setHighlight((h) => !h)}
            />
            <Btn
              icon={<Activity size={13} />}
              label="Replay Last 24h"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Avg. Cycle Time"
          value="18.4d"
          trend="SOP target · 9d"
          tone="warn"
        />
        <Stat
          label="Critical Edges"
          value="1"
          trend="Legal Review bottleneck"
          tone="bad"
        />
        <Stat
          label="Documents In-Flight"
          value="71"
          trend="Across all stages"
          tone="neutral"
        />
        <Stat
          label="SLA Compliance"
          value="64%"
          trend="Down 12pp from last month"
          tone="bad"
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch size={15} className="text-neutral-900" />
          <div className="text-[13px] font-medium text-neutral-900">
            Office SOP Flow Map
          </div>
          <div className="ml-auto text-[10.5px] font-normal text-neutral-500">
            Edge thickness ∝ throughput delay
          </div>
        </div>

        <div className="relative bg-neutral-50 border border-neutral-100 rounded-lg overflow-hidden">
          <svg viewBox="0 0 840 260" className="w-full h-[320px]">
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
              </marker>
              <marker
                id="arrow-red"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="#dc2626" />
              </marker>
            </defs>

            {FLOW_EDGES.map((e, i) => {
              const from = nodeById[e.from];
              const to = nodeById[e.to];
              const t = edgeTone(from, to);
              const dim = highlight && !t.pulse && t.label === "On SLA";
              return (
                <g key={i} opacity={dim ? 0.25 : 1}>
                  <line
                    x1={from.x + 60}
                    y1={from.y}
                    x2={to.x - 60}
                    y2={to.y}
                    stroke={t.stroke}
                    strokeWidth={t.width}
                    markerEnd={
                      t.stroke === "#dc2626" ? "url(#arrow-red)" : "url(#arrow)"
                    }
                    className={t.pulse ? "animate-pulse" : ""}
                    strokeLinecap="round"
                  />
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 8}
                    textAnchor="middle"
                    className="text-[9px] font-medium"
                    fill={t.stroke}
                  >
                    {to.actualHours}h / {to.slaHours}h SLA
                  </text>
                </g>
              );
            })}

            {FLOW_NODES.map((n) => {
              const isBottleneck = n.id === "n3";
              return (
                <g key={n.id}>
                  <rect
                    x={n.x - 60}
                    y={n.y - 24}
                    width="120"
                    height="48"
                    rx="10"
                    fill={isBottleneck ? "#fef2f2" : "#ffffff"}
                    stroke={isBottleneck ? "#dc2626" : "#d4d4d8"}
                    strokeWidth={isBottleneck ? 2 : 1}
                    className={isBottleneck ? "animate-pulse" : ""}
                  />
                  <text
                    x={n.x}
                    y={n.y - 4}
                    textAnchor="middle"
                    className="text-[11px] font-semibold"
                    fill="#171717"
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 12}
                    textAnchor="middle"
                    className="text-[9px] font-normal"
                    fill={isBottleneck ? "#dc2626" : "#737373"}
                  >
                    queue: {n.inQueue} docs
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-4 flex items-center gap-4 text-[10.5px] font-normal text-neutral-500 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-emerald-500" /> On SLA
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-1 bg-amber-500" /> Delayed
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-1.5 bg-red-600 animate-pulse" /> Critical ·
            pulsing
          </div>
          <div className="ml-auto text-neutral-600">
            Legal Review → Procurement edge is 4× SLA. Click Delay Node Alerts
            to diagnose.
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 16.1.B — DELAY NODE ALERTS ====================
