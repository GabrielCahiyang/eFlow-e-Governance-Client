import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, MapPin, Merge, MessageSquare, Users, X } from "lucide-react";
import { Btn, PageHeader, Stat, peso } from "./primitives";

type DuplicationAlert = {
  id: string;
  location: string;
  similarity: number;
  teams: { name: string; lead: string; activity: string; timestamp: string }[];
  estSavings: number;
  status: "flagged" | "merged" | "dismissed";
};

const DUPLICATIONS: DuplicationAlert[] = [
  {
    id: "r1",
    location: "Brgy. Linao · Drainage Zone A",
    similarity: 92,
    teams: [
      {
        name: "Team A · Engineering",
        lead: "Engr. Villegas",
        activity: "Surveying drainage at Brgy. Linao",
        timestamp: "Apr 20 · 09:14",
      },
      {
        name: "Team B · DRRMO Assist",
        lead: "Ms. Bontuyan",
        activity: "Checking flood lines at Brgy. Linao",
        timestamp: "Apr 20 · 10:02",
      },
    ],
    estSavings: 48_000,
    status: "flagged",
  },
  {
    id: "r2",
    location: "Plaza Cancion · North Wall",
    similarity: 87,
    teams: [
      {
        name: "Team C · QA/QC",
        lead: "Engr. Lumapas",
        activity: "Compressive strength test for wall footing",
        timestamp: "Apr 20 · 11:30",
      },
      {
        name: "Team D · Consultant",
        lead: "Engr. Tambago",
        activity: "Load calc verification at north plaza wall",
        timestamp: "Apr 20 · 13:05",
      },
    ],
    estSavings: 22_500,
    status: "flagged",
  },
  {
    id: "r3",
    location: "Coastal Rd · KM 4.2",
    similarity: 74,
    teams: [
      {
        name: "Team E · Paving",
        lead: "Foreman Padojinog",
        activity: "Base course compaction test",
        timestamp: "Apr 20 · 14:20",
      },
      {
        name: "Team F · Materials",
        lead: "Mr. Pial",
        activity: "Compaction density sampling KM 4-5",
        timestamp: "Apr 20 · 14:48",
      },
    ],
    estSavings: 15_000,
    status: "flagged",
  },
];

export function RedundancyFiltering() {
  const [alerts, setAlerts] = useState<DuplicationAlert[]>(DUPLICATIONS);

  const act = (id: string, status: "merged" | "dismissed") => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const totalSavings = alerts
    .filter((a) => a.status === "merged")
    .reduce((s, a) => s + a.estSavings, 0);
  const pending = alerts.filter((a) => a.status === "flagged");

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Redundancy Filtering · Duplication Radar"
        subtitle="NLP-detected overlapping effort across teams · GPS + activity text matched"
        actions={
          <>
            <Btn icon={<Filter size={13} />} label="Threshold: ≥70%" />
            <Btn
              icon={<Merge size={13} />}
              label="Bulk Merge Similar"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Overlaps Detected"
          value={alerts.length.toString()}
          trend="Past 24h across 6 barangays"
          tone="warn"
        />
        <Stat
          label="Pending Review"
          value={pending.length.toString()}
          trend="Awaiting Dept. Head action"
          tone="warn"
        />
        <Stat
          label="Merges Executed"
          value={alerts.filter((a) => a.status === "merged").length.toString()}
          trend="One-click consolidation"
          tone="good"
        />
        <Stat
          label="Est. Savings Captured"
          value={peso(totalSavings)}
          trend="Man-hours + fuel recovered"
          tone="good"
        />
      </div>

      <div className="space-y-3">
        {alerts.map((a) => {
          const isResolved = a.status !== "flagged";
          return (
            <div
              key={a.id}
              className={`border rounded-xl p-5 transition ${a.status === "merged" ? "bg-emerald-50/60 border-emerald-200" : a.status === "dismissed" ? "bg-neutral-50 border-neutral-200 opacity-60" : "bg-white border-amber-200"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.status === "merged" ? "bg-emerald-600" : "bg-amber-500"} text-white`}
                  >
                    {a.status === "merged" ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <AlertTriangle size={15} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-[13px] font-semibold text-neutral-900">
                        Possible Duplication of Effort · {a.location}
                      </div>
                      <span className="text-[9.5px] font-medium uppercase bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 tabular-nums">
                        {a.similarity}% match
                      </span>
                    </div>
                    <div className="text-[11px] font-normal text-neutral-500 mt-0.5">
                      NLP entity overlap + GPS proximity + time window
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9.5px] font-medium uppercase tracking-wider text-neutral-400">
                    Est. Savings
                  </div>
                  <div className="text-[14px] font-semibold text-emerald-700 tabular-nums">
                    {peso(a.estSavings)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-3">
                {a.teams.map((t, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <div className="flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1 text-amber-600">
                          <MapPin size={14} />
                          <div className="text-[8.5px] font-medium uppercase">
                            same area
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="bg-white border border-neutral-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Users size={11} className="text-neutral-600" />
                        <div className="text-[11.5px] font-medium text-neutral-900">
                          {t.name}
                        </div>
                      </div>
                      <div className="text-[10.5px] font-normal text-neutral-500 mb-1.5">
                        {t.lead} · {t.timestamp}
                      </div>
                      <div className="text-[11.5px] font-normal text-neutral-800 italic bg-neutral-50 border border-neutral-100 rounded p-2 leading-relaxed">
                        "{t.activity}"
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {!isResolved ? (
                <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                  <button
                    onClick={() => act(a.id, "merged")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Merge size={13} /> Merge Tasks (1-click)
                  </button>
                  <Btn
                    icon={<MessageSquare size={13} />}
                    label="Ask Teams to Clarify"
                  />
                  <button
                    onClick={() => act(a.id, "dismissed")}
                    className="ml-auto text-[11.5px] font-medium text-neutral-500 hover:text-neutral-700"
                  >
                    Dismiss · not duplicate
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-3 border-t border-emerald-100 text-[11.5px] font-medium">
                  {a.status === "merged" ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-700" />
                      <span className="text-emerald-800">
                        Tasks merged · assigned to lead team · duplicate removed
                        from both mobile lists
                      </span>
                    </>
                  ) : (
                    <>
                      <X size={13} className="text-neutral-500" />
                      <span className="text-neutral-600">
                        Dismissed · marked as parallel legitimate work
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 17.1.A — OPTIMAL DISTRIBUTION MATRIX ====================
