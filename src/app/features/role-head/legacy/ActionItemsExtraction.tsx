import { ArrowRight, Bot, Brain, CheckCircle2, ListChecks } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

type ExtractedAction = {
  id: string;
  sourceText: string;
  author: string;
  timestamp: string;
  extractedTask: string;
  assignee: string;
  dueDate: string;
  status: "created" | "accepted" | "completed";
};

const EXTRACTED: ExtractedAction[] = [
  {
    id: "a1",
    sourceText:
      "I will check the generator fuel levels tomorrow morning before we power up the dewatering pump.",
    author: "Foreman Padojinog",
    timestamp: "Apr 20 · 17:42",
    extractedTask: "Check Generator Fuel · Dewatering Pump",
    assignee: "Foreman Padojinog",
    dueDate: "Apr 21 · 07:00",
    status: "accepted",
  },
  {
    id: "a2",
    sourceText:
      "Need to follow up with the steel supplier about the delayed Grade 40 rebar shipment by Monday.",
    author: "Engr. Tambago",
    timestamp: "Apr 20 · 16:08",
    extractedTask: "Follow up · Steel Supplier (Grade 40 rebar)",
    assignee: "Engr. Tambago",
    dueDate: "Apr 22 · 09:00",
    status: "accepted",
  },
  {
    id: "a3",
    sourceText:
      "Tomorrow I will personally inspect the retaining wall formwork before concrete pour.",
    author: "Engr. Santos",
    timestamp: "Apr 20 · 15:33",
    extractedTask: "Inspect Retaining Wall Formwork · Pre-Pour QA",
    assignee: "Engr. Santos",
    dueDate: "Apr 21 · 06:30",
    status: "created",
  },
  {
    id: "a4",
    sourceText:
      "Will coordinate with Brgy. Linao captain re. road closure permit next week.",
    author: "Mr. Escario",
    timestamp: "Apr 20 · 14:15",
    extractedTask: "Coordinate · Brgy. Linao road closure permit",
    assignee: "Mr. Escario",
    dueDate: "Apr 28 · EOD",
    status: "created",
  },
  {
    id: "a5",
    sourceText:
      "I'll send the updated timesheet for the night shift crew before payroll cutoff.",
    author: "Ms. Lumapas",
    timestamp: "Apr 20 · 13:22",
    extractedTask: "Submit Night-Shift Timesheet · Payroll Cutoff",
    assignee: "Ms. Lumapas",
    dueDate: "Apr 22 · 12:00",
    status: "completed",
  },
];

export function ActionItemsExtraction() {
  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Action Items · NLP Extraction"
        subtitle="Commitments mined from field app text · auto-pushed to mobile to-do lists"
        actions={
          <>
            <Btn icon={<ListChecks size={13} />} label="Export Task Log" />
            <Btn
              icon={<Bot size={13} />}
              label="Tune NLP Filters"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Commitments Mined"
          value={EXTRACTED.length.toString()}
          trend="From 247 field updates"
          tone="neutral"
        />
        <Stat
          label="Auto-Assigned"
          value={EXTRACTED.length.toString()}
          trend="Zero manual entry"
          tone="good"
        />
        <Stat
          label="Acceptance Rate"
          value="94%"
          trend="Staff confirm task fidelity"
          tone="good"
        />
        <Stat
          label="Completed Today"
          value={EXTRACTED.filter(
            (a) => a.status === "completed",
          ).length.toString()}
          trend="Closed-loop execution"
          tone="good"
        />
      </div>

      <div className="space-y-3">
        {EXTRACTED.map((a) => {
          const statusTone =
            a.status === "completed"
              ? {
                  chip: "bg-emerald-50 border-emerald-200 text-emerald-700",
                  label: "Completed",
                }
              : a.status === "accepted"
                ? {
                    chip: "bg-blue-50 border-blue-200 text-blue-700",
                    label: "Accepted · On Staff List",
                  }
                : {
                    chip: "bg-neutral-100 border-neutral-200 text-neutral-700",
                    label: "Created · Pending Accept",
                  };
          return (
            <div
              key={a.id}
              className="bg-white border border-neutral-200 rounded-xl p-4"
            >
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <div>
                  <div className="text-[9.5px] font-medium uppercase tracking-wider text-neutral-400 mb-1.5">
                    Raw Field Report
                  </div>
                  <div className="bg-neutral-50 border border-neutral-100 rounded-lg p-3">
                    <div className="text-[12px] font-normal text-neutral-700 italic leading-relaxed">
                      "{a.sourceText}"
                    </div>
                    <div className="text-[10px] font-normal text-neutral-500 mt-2 flex items-center gap-2">
                      <span className="font-medium text-neutral-700">
                        {a.author}
                      </span>
                      <span>·</span>
                      <span>{a.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 text-indigo-600 shrink-0">
                  <Brain size={18} />
                  <ArrowRight size={14} />
                  <div className="text-[8.5px] font-medium uppercase tracking-wider">
                    NLP
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[9.5px] font-medium uppercase tracking-wider text-emerald-700">
                      Auto-Generated Task
                    </div>
                    <span
                      className={`text-[9.5px] font-medium border rounded px-1.5 py-0.5 ${statusTone.chip}`}
                    >
                      {statusTone.label}
                    </span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        size={13}
                        className="text-emerald-700 mt-0.5 shrink-0"
                      />
                      <div className="text-[12.5px] font-medium text-neutral-900 leading-snug">
                        {a.extractedTask}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-200 grid grid-cols-2 gap-2 text-[10px] font-normal">
                      <div>
                        <span className="text-neutral-500">Assignee: </span>
                        <span className="text-neutral-900 font-medium">
                          {a.assignee}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Due: </span>
                        <span className="text-neutral-900 font-medium tabular-nums">
                          {a.dueDate}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 16.2.C — REDUNDANCY FILTERING ====================
