import React, { useState } from "react";
import { ArrowRight, CheckCircle2, Clock, FileText, Flame, GitMerge, Shield, Sparkles, Zap } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

type Mandate = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  impact: string;
  cost: string;
};

const MANDATES: Mandate[] = [
  {
    id: "m1",
    label: "Temporarily Route to Deputy Officer",
    description:
      "Reroute pending documents to Atty. Nolasco (current load: 22%) for the next 7 days.",
    icon: <GitMerge size={14} />,
    impact: "Clears backlog in ~3 days",
    cost: "Zero additional cost",
  },
  {
    id: "m2",
    label: "Authorize Overtime for this Node",
    description: "Grant Atty. Reyes 20 hours of authorized OT to clear queue.",
    icon: <Clock size={14} />,
    impact: "Clears backlog in ~5 days",
    cost: "₱18,400 OT budget",
  },
  {
    id: "m3",
    label: "Request GA Staff Reassignment",
    description:
      "Genetic Algorithm re-scores all legal officers and rebalances workload.",
    icon: <Sparkles size={14} />,
    impact: "Permanent flow optimization",
    cost: "Zero additional cost",
  },
  {
    id: "m4",
    label: "Escalate to City Administrator",
    description:
      "Route the bottleneck report directly to the Mayor's Office for executive action.",
    icon: <Zap size={14} />,
    impact: "Policy-level response",
    cost: "Consumes political capital",
  },
];

export function InterventionMandates() {
  const [executing, setExecuting] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const execute = (id: string) => {
    setExecuting(id);
    setTimeout(() => {
      setApplied(new Set([...applied, id]));
      setExecuting(null);
    }, 1400);
  };

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Intervention Mandates · Legal Review Node"
        subtitle="One-click BPA rerouting commands · GA-orchestrated"
        actions={
          <>
            <Btn icon={<FileText size={13} />} label="View Node Diagnostic" />
            <Btn
              icon={<Shield size={13} />}
              label="Audit Trail"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Bottleneck Cost"
          value="₱420K/day"
          trend="Project delay penalty estimate"
          tone="bad"
        />
        <Stat
          label="Available Mandates"
          value={MANDATES.length.toString()}
          trend="Authority-scoped to Dept. Head"
          tone="neutral"
        />
        <Stat
          label="Mandates Applied"
          value={applied.size.toString()}
          trend="Active interventions"
          tone="good"
        />
        <Stat
          label="Projected Clearance"
          value={applied.size > 0 ? "~3d" : "21d"}
          trend={
            applied.size > 0 ? "Post-intervention" : "Without intervention"
          }
          tone={applied.size > 0 ? "good" : "bad"}
        />
      </div>

      <div className="bg-gradient-to-br from-red-50 to-amber-50 border border-red-200 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shrink-0 animate-pulse">
            <Flame size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-neutral-900">
              Active Traffic Jam · Legal Review · Atty. Reyes
            </div>
            <div className="text-[11.5px] font-normal text-neutral-700 mt-0.5">
              42 documents queued · 288h average clearance (4× SLA) · HRMO
              burnout flag active. Select an intervention below to instantly
              command the Genetic Algorithm to reroute digital paperwork.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MANDATES.map((m) => {
          const isApplied = applied.has(m.id);
          const isExec = executing === m.id;
          return (
            <div
              key={m.id}
              className={`bg-white border rounded-xl p-5 transition ${isApplied ? "border-emerald-400" : "border-neutral-200"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isApplied ? "bg-emerald-600 text-white" : "bg-neutral-900 text-white"}`}
                  >
                    {isApplied ? <CheckCircle2 size={14} /> : m.icon}
                  </div>
                  <div>
                    <div className="text-[12.5px] font-semibold text-neutral-900">
                      {m.label}
                    </div>
                    <div className="text-[10.5px] font-normal text-neutral-500 mt-0.5 leading-relaxed">
                      {m.description}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-neutral-50 border border-neutral-100 rounded-lg p-2.5">
                  <div className="text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                    Projected Impact
                  </div>
                  <div className="text-[11.5px] font-medium text-emerald-700 mt-0.5">
                    {m.impact}
                  </div>
                </div>
                <div className="bg-neutral-50 border border-neutral-100 rounded-lg p-2.5">
                  <div className="text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                    Cost
                  </div>
                  <div className="text-[11.5px] font-medium text-neutral-900 mt-0.5">
                    {m.cost}
                  </div>
                </div>
              </div>
              <button
                onClick={() => execute(m.id)}
                disabled={isExec || isApplied}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition ${
                  isApplied
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                    : isExec
                      ? "bg-indigo-100 text-indigo-700 cursor-wait"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {isApplied ? (
                  <>
                    <CheckCircle2 size={13} /> Mandate Active
                  </>
                ) : isExec ? (
                  <>
                    <Zap size={13} className="animate-pulse" /> GA Rerouting…
                  </>
                ) : (
                  <>
                    Execute Mandate <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 16.2.A — DAILY SUMMARY ====================
