import { useState } from "react";
import { Ban as BanIcon, Bell, Download, Info, Lock as LockIcon, Shield, Timer } from "lucide-react";
import type { Task } from "../../../services/taskService";
import type { Employee } from "../../../services/employeeService";
import { Btn, PageHeader, Stat, peso, pesoShort } from "./primitives";

type DelinquentLeader = {
  id: string;
  name: string;
  role: string;
  advance: number;
  purpose: string;
  issued: string;
  daysOld: number;
  linkedProject: string;
  suspended: boolean;
};

const LEADERS: DelinquentLeader[] = [
  {
    id: "dl1",
    name: "Engr. Ramon Cruz",
    role: "Site Engineer",
    advance: 185_000,
    purpose: "Field materials advance · Coastal Rd.",
    issued: "Mar 27, 2026",
    daysOld: 25,
    linkedProject: "Coastal Road Rehabilitation",
    suspended: false,
  },
  {
    id: "dl2",
    name: "Foreman Padojinog",
    role: "Foreman · Concrete",
    advance: 72_000,
    purpose: "Subcontractor petty cash · pavilion",
    issued: "Apr 02, 2026",
    daysOld: 19,
    linkedProject: "Eco-Park Phase 1",
    suspended: false,
  },
  {
    id: "dl3",
    name: "Mr. Escario",
    role: "Heavy Equip. Op.",
    advance: 42_000,
    purpose: "Fuel & maintenance advance",
    issued: "Apr 06, 2026",
    daysOld: 15,
    linkedProject: "Coastal Road Rehabilitation",
    suspended: false,
  },
  {
    id: "dl4",
    name: "Engr. Tambago",
    role: "QA/QC Officer",
    advance: 28_500,
    purpose: "Seminar registration advance",
    issued: "Apr 10, 2026",
    daysOld: 11,
    linkedProject: "Fire Station Annex",
    suspended: false,
  },
  {
    id: "dl5",
    name: "Ms. Lumapas",
    role: "Safety Officer",
    advance: 18_000,
    purpose: "PPE bulk purchase pre-pay",
    issued: "Apr 14, 2026",
    daysOld: 7,
    linkedProject: "All sites",
    suspended: false,
  },
];

export function LeaderExpenseReports({}: {
  tasks?: Task[];
  employees?: Employee[];
  departmentId?: string;
}) {
  const [rows, setRows] = useState<DelinquentLeader[]>(LEADERS);
  const [suspendConfirm, setSuspendConfirm] = useState<string | null>(null);

  const suspend = (id: string) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, suspended: true } : r)));
    setSuspendConfirm(null);
  };

  const total = rows.reduce((s, r) => s + r.advance, 0);
  const critical = rows.filter((r) => r.daysOld > 20);
  const suspended = rows.filter((r) => r.suspended);

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Leader Expense Reports · Liquidation Whip"
        subtitle="Treasury-flagged delinquent cash advances · COA shield"
        actions={
          <>
            <Btn icon={<Bell size={13} />} label="Broadcast Reminder" />
            <Btn
              icon={<Download size={13} />}
              label="Export COA Response"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Leaders with CA"
          value={rows.length.toString()}
          trend="Your direct reports"
          tone="neutral"
        />
        <Stat
          label="Past 20 Days"
          value={critical.length.toString()}
          trend="COA memo risk"
          tone="bad"
        />
        <Stat
          label="Funds Suspended"
          value={suspended.length.toString()}
          trend="BPA-blocked from new POs"
          tone="warn"
        />
        <Stat
          label="Outstanding Total"
          value={pesoShort(total)}
          trend="Awaiting receipts"
          tone="warn"
        />
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
        <Shield size={14} className="text-red-700 mt-0.5 shrink-0" />
        <div className="text-[11.5px] font-normal text-red-900 leading-relaxed">
          <span className="font-medium">
            COA shield active.
          </span>{" "}
          City Treasurer has flagged leaders on this list. Suspending their
          project funds automatically blocks new material requests or cash
          advances via the BPA engine until receipts are uploaded. This protects
          you from AOMs (Audit Observation Memos) addressed to the Office
          Head.
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.3fr_1fr_1.5fr_1fr_1fr_0.9fr_auto] gap-3 px-5 py-3 bg-neutral-50 border-b border-neutral-200 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          <div>Leader</div>
          <div>Role</div>
          <div>Purpose</div>
          <div>Advance</div>
          <div>Issued</div>
          <div>Aging</div>
          <div>Action</div>
        </div>
        {rows.map((r) => {
          const isOver = r.daysOld > 20;
          const isWarn = r.daysOld > 10;
          return (
            <div
              key={r.id}
              className={`grid grid-cols-[1.3fr_1fr_1.5fr_1fr_1fr_0.9fr_auto] gap-3 px-5 py-3.5 border-b border-neutral-100 items-center ${r.suspended ? "bg-red-50/60" : isOver ? "bg-amber-50/40" : ""}`}
            >
              <div>
                <div className="text-[12.5px] font-medium text-neutral-900">
                  {r.name}
                </div>
                <div className="text-[10px] font-normal text-neutral-500">
                  Linked: {r.linkedProject}
                </div>
              </div>
              <div className="text-[11.5px] font-normal text-neutral-700">
                {r.role}
              </div>
              <div className="text-[11.5px] font-normal text-neutral-600 truncate">
                {r.purpose}
              </div>
              <div className="text-[12px] font-medium text-neutral-900 tabular-nums">
                {peso(r.advance)}
              </div>
              <div className="text-[11.5px] font-normal text-neutral-600 tabular-nums">
                {r.issued}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Timer
                    size={11}
                    className={
                      isOver
                        ? "text-red-600"
                        : isWarn
                          ? "text-amber-600"
                          : "text-neutral-500"
                    }
                  />
                  <span
                    className={`text-[11px] font-medium tabular-nums ${isOver ? "text-red-700" : isWarn ? "text-amber-700" : "text-neutral-700"}`}
                  >
                    {r.daysOld}d old
                  </span>
                </div>
                <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${isOver ? "bg-red-500" : isWarn ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{
                      width: `${Math.min(100, (r.daysOld / 30) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                {r.suspended ? (
                  <span className="text-[10px] font-medium uppercase bg-red-600 text-white rounded px-2 py-1 flex items-center gap-1 whitespace-nowrap">
                    <LockIcon size={10} /> Funds Suspended
                  </span>
                ) : suspendConfirm === r.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => suspend(r.id)}
                      className="text-[10px] font-medium bg-red-600 text-white rounded px-2 py-1 hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setSuspendConfirm(null)}
                      className="text-[10px] font-medium text-neutral-500 hover:text-neutral-800 px-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSuspendConfirm(r.id)}
                    className={`text-[10px] font-medium uppercase rounded px-2 py-1 border whitespace-nowrap ${isOver ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}
                  >
                    <span className="flex items-center gap-1">
                      <BanIcon size={10} /> Suspend Funds
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={14} className="text-neutral-600 mt-0.5 shrink-0" />
        <div className="text-[11.5px] font-normal text-neutral-700 leading-relaxed">
          <span className="font-medium text-neutral-900">
            BPA enforcement.
          </span>{" "}
          Suspend Funds routes through the Business Process Automation engine:
          the leader's mobile app immediately blocks new material requests, cash
          advance applications, and travel orders tied to the linked project.
          The block auto-lifts the moment receipts are uploaded and acknowledged
          by the City Accountant.
        </div>
      </div>
    </div>
  );
}

// ==================== SUBORDINATE MANAGER ====================
