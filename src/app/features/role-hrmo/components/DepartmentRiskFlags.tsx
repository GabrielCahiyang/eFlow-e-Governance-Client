import { useMemo, useState } from "react";
import { Brain, ChevronRight, Clock, Flame, Heart, RefreshCw, Sparkles } from "lucide-react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { Btn, PageHeader, Stat } from "./primitives";

type RiskLevel = "optimal" | "elevated" | "critical";

type Dept = {
  id: string;
  name: string;
  staff: number;
  fatiguePct: number;
  risk: RiskLevel;
  avgLatencyHrs: number;
  baselineLatencyHrs: number;
  weeksSinceLowLoad: number;
  sprintLoad: number;
  topStrainName: string;
};

const DEPARTMENTS: Dept[] = [
  { id: "eng", name: "Engineering", staff: 142, fatiguePct: 85, risk: "critical", avgLatencyHrs: 18.0, baselineLatencyHrs: 4.2, weeksSinceLowLoad: 31, sprintLoad: 94, topStrainName: "Engr. A. Dela Cruz" },
  { id: "hlth", name: "Health Office", staff: 208, fatiguePct: 71, risk: "critical", avgLatencyHrs: 9.6, baselineLatencyHrs: 3.1, weeksSinceLowLoad: 22, sprintLoad: 88, topStrainName: "Dr. M. Sabando" },
  { id: "led", name: "LEDIPO", staff: 54, fatiguePct: 48, risk: "elevated", avgLatencyHrs: 6.2, baselineLatencyHrs: 3.8, weeksSinceLowLoad: 14, sprintLoad: 72, topStrainName: "L. Bascon" },
  { id: "dswd", name: "Social Welfare", staff: 96, fatiguePct: 52, risk: "elevated", avgLatencyHrs: 7.9, baselineLatencyHrs: 4.6, weeksSinceLowLoad: 18, sprintLoad: 76, topStrainName: "J. Pomentil" },
  { id: "env", name: "Environment (CENRO)", staff: 68, fatiguePct: 41, risk: "elevated", avgLatencyHrs: 5.4, baselineLatencyHrs: 3.5, weeksSinceLowLoad: 12, sprintLoad: 68, topStrainName: "R. Alcantara" },
  { id: "tour", name: "Tourism", staff: 32, fatiguePct: 22, risk: "optimal", avgLatencyHrs: 3.8, baselineLatencyHrs: 3.4, weeksSinceLowLoad: 3, sprintLoad: 44, topStrainName: "—" },
  { id: "agri", name: "Agriculture", staff: 78, fatiguePct: 19, risk: "optimal", avgLatencyHrs: 4.1, baselineLatencyHrs: 3.9, weeksSinceLowLoad: 2, sprintLoad: 38, topStrainName: "—" },
  { id: "gso", name: "General Services", staff: 114, fatiguePct: 28, risk: "optimal", avgLatencyHrs: 4.7, baselineLatencyHrs: 4.2, weeksSinceLowLoad: 5, sprintLoad: 51, topStrainName: "—" },
  { id: "treas", name: "City Treasury", staff: 62, fatiguePct: 34, risk: "elevated", avgLatencyHrs: 5.1, baselineLatencyHrs: 3.7, weeksSinceLowLoad: 9, sprintLoad: 63, topStrainName: "C. Villamor" },
  { id: "pln", name: "City Planning", staff: 40, fatiguePct: 66, risk: "critical", avgLatencyHrs: 11.2, baselineLatencyHrs: 4.0, weeksSinceLowLoad: 20, sprintLoad: 82, topStrainName: "Arch. P. Odal" },
  { id: "leg", name: "Legal Office", staff: 28, fatiguePct: 43, risk: "elevated", avgLatencyHrs: 6.8, baselineLatencyHrs: 4.4, weeksSinceLowLoad: 11, sprintLoad: 65, topStrainName: "Atty. F. Lariosa" },
  { id: "itc", name: "ICT Office", staff: 36, fatiguePct: 24, risk: "optimal", avgLatencyHrs: 3.1, baselineLatencyHrs: 2.9, weeksSinceLowLoad: 4, sprintLoad: 47, topStrainName: "—" },
];

const riskStyles: Record<RiskLevel, { ring: string; chip: string; glow: string; dot: string; label: string }> = {
  optimal: {
    ring: "border-emerald-200",
    chip: "bg-emerald-100 text-emerald-700",
    glow: "from-emerald-50 to-white",
    dot: "bg-emerald-500",
    label: "Optimal",
  },
  elevated: {
    ring: "border-amber-200",
    chip: "bg-amber-100 text-amber-700",
    glow: "from-amber-50 to-white",
    dot: "bg-amber-500",
    label: "Elevated",
  },
  critical: {
    ring: "border-red-300",
    chip: "bg-red-100 text-red-700",
    glow: "from-red-100 to-red-50",
    dot: "bg-red-600",
    label: "Critical",
  },
};

export function DepartmentRiskFlags() {
  const [selected, setSelected] = useState<Dept>(DEPARTMENTS[0]);
  const [showIntervention, setShowIntervention] = useState(false);

  const counts = useMemo(() => {
    return DEPARTMENTS.reduce(
      (acc, d) => {
        acc[d.risk]++;
        return acc;
      },
      { optimal: 0, elevated: 0, critical: 0 } as Record<RiskLevel, number>
    );
  }, []);

  return (
    <div>
      <PageHeader
        title="City-Wide Fatigue Radar"
        subtitle="Predictive burnout surveillance across 12 offices · updated 4 minutes ago"
        actions={
          <>
            <Btn icon={<RefreshCw size={14} />} label="Recompute" />
            <Btn icon={<Heart size={14} />} label="Initiate Wellness Intervention" variant="primary" onClick={() => setShowIntervention(true)} />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="Workforce" value="2,068" trend="across 12 departments" />
        <Stat label="Optimal" value={String(counts.optimal)} trend="green-zone offices" tone="good" />
        <Stat label="Elevated" value={String(counts.elevated)} trend="require monitoring" tone="warn" />
        <Stat label="Critical" value={String(counts.critical)} trend="intervention recommended" tone="bad" />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={14} className="text-neutral-700" />
          <span className="text-[12px] font-medium text-neutral-700">AI Fatigue Synthesis</span>
          <span className="text-[10px] font-normal text-neutral-400 ml-auto">model v4.2 · confidence 0.91</span>
        </div>
        <p className="text-[13px] font-normal text-neutral-600 leading-relaxed">
          Three offices are crossing critical fatigue thresholds. <span className="text-red-600 font-medium">Engineering</span> shows the steepest decline — cursor-latency data indicates 85% of staff are operating at 4.3× their baseline response time. Without intervention within <span className="font-medium">72 hours</span>, the model predicts a 38% probability of cascading sick-leave filings.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {DEPARTMENTS.map((d) => {
          const s = riskStyles[d.risk];
          const isActive = selected.id === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className={`text-left rounded-xl border bg-gradient-to-br ${s.glow} ${s.ring} p-4 cursor-pointer transition-all hover:shadow-md ${
                isActive ? "ring-2 ring-neutral-900 ring-offset-2" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                {d.risk === "critical" && <Flame size={14} className="text-red-600" />}
              </div>
              <div className="text-[14px] font-semibold text-neutral-900">{d.name}</div>
              <div className="text-[11px] font-normal text-neutral-500 mt-0.5">
                {d.staff} staff · {d.fatiguePct}% fatigued
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className={`h-full ${d.risk === "critical" ? "bg-red-500" : d.risk === "elevated" ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${d.fatiguePct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-down */}
      <div className="mt-6 bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Drill-down · {riskStyles[selected.risk].label}
            </div>
            <div className="text-[16px] font-semibold text-neutral-900 mt-0.5">{selected.name}</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-normal">
            The Proof <ChevronRight size={12} />
          </div>
        </div>

        <div className="grid grid-cols-2">
          {/* Response Latency Timeline */}
          <div className="p-5 border-r border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] font-medium text-neutral-700 flex items-center gap-1.5">
                <Clock size={12} /> Response Latency (site permits)
              </div>
              <span className="text-[11px] text-neutral-400 font-normal">14-day window</span>
            </div>
            <LatencyChart baseline={selected.baselineLatencyHrs} current={selected.avgLatencyHrs} />
            <div className="mt-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-700 mb-1">
                <Sparkles size={11} /> AI Insight
              </div>
              <p className="text-[12px] font-normal text-neutral-600 leading-relaxed">
                <span className="font-medium text-neutral-900">{selected.topStrainName}</span> usually approves tickets in <span className="font-medium">{selected.baselineLatencyHrs}h</span>. Over 14 days, average has dropped to <span className="text-red-600 font-medium">{selected.avgLatencyHrs}h</span> — cognitive fatigue marker.
              </p>
            </div>
          </div>

          {/* Burn rate */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] font-medium text-neutral-700 flex items-center gap-1.5">
                <Flame size={12} /> Cumulative Sprint Load
              </div>
              <span className="text-[11px] text-neutral-400 font-normal">26-week continuous</span>
            </div>
            <BurnRateChart load={selected.sprintLoad} weeksSinceLowLoad={selected.weeksSinceLowLoad} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <div className="text-[10px] font-medium uppercase text-neutral-400 tracking-wider">Weeks since low-load</div>
                <div className={`text-[18px] font-semibold mt-0.5 ${selected.weeksSinceLowLoad > 24 ? "text-red-600" : selected.weeksSinceLowLoad > 12 ? "text-amber-600" : "text-emerald-600"}`}>
                  {selected.weeksSinceLowLoad}w
                </div>
              </div>
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <div className="text-[10px] font-medium uppercase text-neutral-400 tracking-wider">Sprint load index</div>
                <div className={`text-[18px] font-semibold mt-0.5 ${selected.sprintLoad > 80 ? "text-red-600" : selected.sprintLoad > 60 ? "text-amber-600" : "text-emerald-600"}`}>
                  {selected.sprintLoad}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showIntervention && (
        <FeatureDialog onClose={() => setShowIntervention(false)} title="Initiate Wellness Intervention" description={`Trigger a non-punitive outreach sequence for ${selected.name}.`} contentClassName="!max-w-md">
          <div className="w-full p-6 pr-12">
            <div className="flex items-center gap-2 mb-2">
              <Heart size={16} className="text-red-600" />
              <h3 className="text-[16px] font-semibold">Initiate Wellness Intervention</h3>
            </div>
            <p className="text-[13px] font-normal text-neutral-600 mb-4">
              Trigger a non-punitive outreach sequence for <span className="font-medium">{selected.name}</span>. Counselor assignment, load-cap mandate, and a private 1:1 will be scheduled automatically.
            </p>
            <div className="flex gap-2">
              <button className="flex-1 py-2.5 bg-neutral-100 rounded-lg text-[13px] font-medium hover:bg-neutral-200 cursor-pointer" onClick={() => setShowIntervention(false)}>
                Cancel
              </button>
              <button className="flex-1 py-2.5 bg-neutral-900 text-white rounded-lg text-[13px] font-medium hover:bg-neutral-800 cursor-pointer" onClick={() => setShowIntervention(false)}>
                Dispatch Intervention
              </button>
            </div>
          </div>
        </FeatureDialog>
      )}
    </div>
  );
}

// --- Latency chart (pure SVG)
function LatencyChart({ baseline, current }: { baseline: number; current: number }) {
  const points = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const noise = Math.sin(i * 1.3) * 0.6;
      arr.push(baseline + (current - baseline) * t * t + noise);
    }
    return arr;
  }, [baseline, current]);
  const max = Math.max(...points, current) * 1.1;
  const W = 420;
  const H = 130;
  const dx = W / (points.length - 1);

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * dx} ${H - (p / max) * H}`).join(" ");
  const baselineY = H - (baseline / max) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lat-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1="0" y1={baselineY} x2={W} y2={baselineY} stroke="#10b981" strokeDasharray="3 3" strokeWidth="1" />
      <text x={W - 4} y={baselineY - 4} textAnchor="end" fontSize="9" fill="#10b981" fontFamily="Figtree">
        baseline {baseline}h
      </text>
      {/* area */}
      <path d={`${pathD} L ${W} ${H} L 0 ${H} Z`} fill="url(#lat-grad)" />
      {/* line */}
      <path d={pathD} fill="none" stroke="#ef4444" strokeWidth="1.75" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * dx} cy={H - (p / max) * H} r="2" fill="#ef4444" />
      ))}
      <text x="0" y={H + 12} fontSize="9" fill="#a3a3a3" fontFamily="Figtree">
        Day 1
      </text>
      <text x={W} y={H + 12} textAnchor="end" fontSize="9" fill="#a3a3a3" fontFamily="Figtree">
        Today
      </text>
    </svg>
  );
}

// --- Burn rate chart
function BurnRateChart({ load, weeksSinceLowLoad }: { load: number; weeksSinceLowLoad: number }) {
  const weeks = 26;
  const values = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < weeks; i++) {
      const progress = i / (weeks - 1);
      const base = 30 + progress * (load - 30);
      const wiggle = Math.sin(i * 0.9) * 8;
      arr.push(Math.max(8, Math.min(100, base + wiggle)));
    }
    return arr;
  }, [load]);
  const W = 420;
  const H = 130;
  const bw = W / weeks - 2;
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" preserveAspectRatio="none">
      <line x1="0" y1={H - (40 / 100) * H} x2={W} y2={H - (40 / 100) * H} stroke="#d4d4d4" strokeDasharray="2 2" strokeWidth="1" />
      <text x="2" y={H - (40 / 100) * H - 3} fontSize="9" fill="#a3a3a3" fontFamily="Figtree">
        low-load zone
      </text>
      {values.map((v, i) => {
        const h = (v / 100) * H;
        const color = v > 80 ? "#dc2626" : v > 60 ? "#f59e0b" : "#10b981";
        const lowLoadIdx = weeks - weeksSinceLowLoad - 1;
        const isLastLow = i === lowLoadIdx;
        return (
          <g key={i}>
            <rect x={i * (bw + 2)} y={H - h} width={bw} height={h} fill={color} rx="1" opacity={0.85} />
            {isLastLow && (
              <>
                <line x1={i * (bw + 2) + bw / 2} y1={0} x2={i * (bw + 2) + bw / 2} y2={H} stroke="#525252" strokeDasharray="2 2" />
                <text x={i * (bw + 2) + bw / 2 + 4} y={10} fontSize="8" fill="#525252" fontFamily="Figtree">
                  last low-load
                </text>
              </>
            )}
          </g>
        );
      })}
      <text x="0" y={H + 12} fontSize="9" fill="#a3a3a3" fontFamily="Figtree">
        26 weeks ago
      </text>
      <text x={W} y={H + 12} textAnchor="end" fontSize="9" fill="#a3a3a3" fontFamily="Figtree">
        This week
      </text>
    </svg>
  );
}

// ==================== 9.2.A — EQUITABLE DISTRIBUTION ====================
