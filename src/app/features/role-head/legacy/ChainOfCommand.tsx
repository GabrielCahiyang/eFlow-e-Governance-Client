import React, { useState } from "react";
import { CheckCircle2, ChevronRight, GitBranch, Zap } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

type OrgNode = { id: string; title: string; person?: string; level: number };

const ORG_NODES: OrgNode[] = [
  { id: "n1", title: "Laborer", person: "Pool · 12 members", level: 0 },
  { id: "n2", title: "Site Foreman", person: "Mr. Arnel Padojinog", level: 1 },
  {
    id: "n3",
    title: "Site Supervisor",
    person: "Engr. Mario Santos",
    level: 2,
  },
  {
    id: "n4",
    title: "Project Manager",
    person: "Engr. Rolando Dacayo",
    level: 3,
  },
  {
    id: "n5",
    title: "Head",
    person: "Engr. Rolando Dacayo",
    level: 4,
  },
];

export function ChainOfCommand() {
  const [flowDemo, setFlowDemo] = useState(false);
  const [flowStep, setFlowStep] = useState(0);

  const runDemo = () => {
    setFlowDemo(true);
    setFlowStep(0);
    const steps = [0, 1, 2, 3, 4];
    steps.forEach((s, i) => setTimeout(() => setFlowStep(s), i * 700));
    setTimeout(() => setFlowDemo(false), steps.length * 700 + 1200);
  };

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Chain of Command · Approval Matrix"
        subtitle="Dynamic org chart builder · Eco-Park Task Force BPA"
        actions={
          <>
            <Btn icon={<GitBranch size={13} />} label="Branch Flow" />
            <Btn
              icon={<Zap size={13} />}
              label="Simulate Routing"
              variant="primary"
              onClick={runDemo}
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Approval Layers"
          value={ORG_NODES.length.toString()}
          trend="Laborer → Dept. Head"
          tone="neutral"
        />
        <Stat
          label="Avg. Routing Time"
          value="4.2h"
          trend="Per task completion"
          tone="good"
        />
        <Stat
          label="Auto-Escalations"
          value="0"
          trend="No SLA breaches"
          tone="good"
        />
        <Stat
          label="BPA Pipeline"
          value="Active"
          trend="Wired to mobile app"
          tone="good"
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <GitBranch size={15} className="text-neutral-900" />
          <div className="text-[13px] font-medium text-neutral-900">
            Task Completion Routing
          </div>
          <div className="ml-auto text-[10.5px] font-normal text-neutral-500">
            When a laborer marks a task complete on the mobile app, it
            physically travels this exact path.
          </div>
        </div>

        <div className="relative flex items-stretch justify-between gap-4">
          {ORG_NODES.map((node, i) => {
            const active = flowDemo && flowStep >= i;
            return (
              <React.Fragment key={node.id}>
                <div className={`flex-1 relative`}>
                  <div
                    className={`bg-white border-2 rounded-xl p-4 transition-all ${active ? "border-emerald-500 shadow-lg shadow-emerald-100 -translate-y-1" : "border-neutral-200"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${active ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-600"}`}
                      >
                        {node.level}
                      </div>
                      <div className="text-[11.5px] font-medium text-neutral-900">
                        {node.title}
                      </div>
                    </div>
                    <div className="text-[10.5px] font-normal text-neutral-500 truncate">
                      {node.person}
                    </div>
                    {active && i < ORG_NODES.length - 1 && (
                      <div className="mt-2 text-[9.5px] font-medium uppercase text-emerald-700 flex items-center gap-1">
                        <Zap size={9} /> routing…
                      </div>
                    )}
                    {active && i === ORG_NODES.length - 1 && (
                      <div className="mt-2 text-[9.5px] font-medium uppercase text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={9} /> approved
                      </div>
                    )}
                  </div>
                </div>
                {i < ORG_NODES.length - 1 && (
                  <div className="flex items-center shrink-0 pt-5">
                    <ChevronRight
                      size={20}
                      className={
                        active && flowStep > i
                          ? "text-emerald-500"
                          : "text-neutral-300"
                      }
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-100 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-2">
              Route Configuration
            </div>
            <div className="space-y-1.5">
              {ORG_NODES.map((n, i) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 text-[11.5px] font-normal text-neutral-600"
                >
                  <span className="w-5 h-5 rounded bg-neutral-100 text-neutral-700 flex items-center justify-center text-[10px] font-medium">
                    {i + 1}
                  </span>
                  <span className="text-neutral-900 font-medium">
                    {n.title}
                  </span>
                  <span className="text-neutral-400">→</span>
                  <span className="truncate">{n.person}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-2">
              BPA Rules
            </div>
            <div className="space-y-1.5 text-[11.5px] font-normal text-neutral-700">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-600 mt-0.5" />{" "}
                Approvals cascade upward only
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-600 mt-0.5" />{" "}
                48h SLA auto-escalates to next tier
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-600 mt-0.5" />{" "}
                Photos + GPS required at level 0
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-600 mt-0.5" />{" "}
                Immutable audit trail per hop
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 16.1.A — PROCESS MINING GRAPHS ====================
