import { Bot, Brain, CloudRain, Download, Flame, Info, TrendingUp } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

type BriefingItem = {
  id: string;
  priority: "good" | "normal" | "critical";
  headline: string;
  detail: string;
  sourceCount: number;
};

const BRIEFING: BriefingItem[] = [
  {
    id: "b1",
    priority: "good",
    headline: "Paving on Coastal Road is 15% ahead of schedule",
    detail:
      "Foreman Padojinog reports base course completion 2 days ahead. Synthesized from 14 field photos, 6 voice notes, and GPS logs.",
    sourceCount: 20,
  },
  {
    id: "b2",
    priority: "normal",
    headline: "Heavy rain halted Eco-Park earthmoving; equipment secured",
    detail:
      "3 foremen reported weather stoppage by 14:22. All heavy equipment returned to motor pool. No damage. Expected resumption: tomorrow 07:00.",
    sourceCount: 8,
  },
  {
    id: "b3",
    priority: "critical",
    headline:
      "Cement delivery for Plaza Renovation rejected due to quality issues",
    detail:
      "QA Officer Lumapas rejected 240 bags (Lot #A-2026-04-11) from Reyes Construction Supplies — below 28-day compressive strength spec. Supplier notified. Replacement ETA: 48h.",
    sourceCount: 5,
  },
];

export function DailySummary() {
  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Morning Executive Briefing · Apr 21, 2026 · 08:00"
        subtitle="NLP synthesis of 247 field app updates from yesterday"
        actions={
          <>
            <Btn icon={<Download size={13} />} label="Export: PDF Report" />
            <Btn
              icon={<Bot size={13} />}
              label="Ask Briefing AI"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Field Updates Read"
          value="247"
          trend="14 foremen · 33 team leads"
          tone="neutral"
        />
        <Stat
          label="Reading Time Saved"
          value="~2.4h"
          trend="vs. manual stand-up"
          tone="good"
        />
        <Stat
          label="Critical Flags"
          value={BRIEFING.filter(
            (b) => b.priority === "critical",
          ).length.toString()}
          trend="Require Dept. Head attention"
          tone="bad"
        />
        <Stat
          label="NLP Confidence"
          value="96%"
          trend="Entity & intent extraction"
          tone="good"
        />
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-neutral-900">
              eFlow Briefing AI
            </div>
            <div className="text-[10.5px] font-normal text-neutral-500">
              Synthesized from field reports · Ormoc Engineering Office
            </div>
          </div>
          <div className="ml-auto text-[10.5px] font-medium text-indigo-700 bg-white border border-indigo-200 rounded px-2 py-1">
            3 bullets
          </div>
        </div>

        <div className="space-y-3">
          {BRIEFING.map((b, i) => {
            const tone =
              b.priority === "critical"
                ? {
                    icon: <Flame size={14} className="text-red-600" />,
                    bg: "bg-red-50",
                    border: "border-red-200",
                    chip: "text-red-700 bg-white border-red-200",
                    label: "CRITICAL",
                  }
                : b.priority === "good"
                  ? {
                      icon: (
                        <TrendingUp size={14} className="text-emerald-600" />
                      ),
                      bg: "bg-emerald-50",
                      border: "border-emerald-200",
                      chip: "text-emerald-700 bg-white border-emerald-200",
                      label: "POSITIVE",
                    }
                  : {
                      icon: <CloudRain size={14} className="text-blue-600" />,
                      bg: "bg-blue-50",
                      border: "border-blue-200",
                      chip: "text-blue-700 bg-white border-blue-200",
                      label: "FYI",
                    };
            return (
              <div
                key={b.id}
                className={`${tone.bg} border ${tone.border} rounded-lg p-4`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white shrink-0">
                    {tone.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-neutral-400">
                        #{i + 1}
                      </span>
                      <span
                        className={`text-[9.5px] font-medium uppercase border rounded px-1.5 py-0.5 ${tone.chip}`}
                      >
                        {tone.label}
                      </span>
                      <span className="ml-auto text-[10px] font-normal text-neutral-500">
                        synthesized from {b.sourceCount} sources
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold text-neutral-900 leading-snug">
                      {b.headline}
                    </div>
                    <div className="text-[11.5px] font-normal text-neutral-600 mt-1 leading-relaxed">
                      {b.detail}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-indigo-100 flex items-center gap-2 text-[11px] font-normal text-neutral-600">
          <Info size={12} />
          Stand-up meeting replaced. 15 foremen continue field deployment.
          Approximate city savings:{" "}
          <span className="font-medium text-neutral-900">
            36 man-hours/day
          </span>
          .
        </div>
      </div>
    </div>
  );
}

// ==================== 16.2.B — ACTION ITEMS EXTRACTION ====================
