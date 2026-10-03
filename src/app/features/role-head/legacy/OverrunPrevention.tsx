import { useState } from "react";
import { AlertOctagon, CheckCircle2, FileText, Gauge, ReceiptText, RefreshCw } from "lucide-react";
import type { Task } from "../../../services/taskService";
import type { Employee } from "../../../services/employeeService";
import { Btn, PageHeader, Stat, peso, pesoShort } from "./primitives";

type PendingRequest = {
  id: string;
  title: string;
  requester: string;
  site: string;
  amount: number;
  category: string;
};

const PENDING: PendingRequest[] = [
  {
    id: "pr1",
    title: "Portland Cement · 800 bags",
    requester: "Supv. Santos · Coastal Rd.",
    site: "KM 4.2",
    amount: 800_000,
    category: "Materials",
  },
  {
    id: "pr2",
    title: "Steel Rebar · Grade 40",
    requester: "Engr. Tambago · Eco-Park",
    site: "Pavilion",
    amount: 640_000,
    category: "Materials",
  },
  {
    id: "pr3",
    title: "Heavy Equipment Rental · 3 days",
    requester: "Foreman Padojinog · Drainage",
    site: "Brgy. Linao",
    amount: 180_000,
    category: "Rental",
  },
  {
    id: "pr4",
    title: "Safety Gear · PPE set × 40",
    requester: "Safety Ofc. Lumapas",
    site: "All sites",
    amount: 96_000,
    category: "PPE",
  },
];

export function OverrunPrevention({}: {
  tasks?: Task[];
  employees?: Employee[];
  departmentId?: string;
}) {
  const STARTING_BALANCE = 5_200_000;
  const CRITICAL_BUFFER = 500_000;
  const [selected, setSelected] = useState<Set<string>>(new Set(["pr1"]));

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const simulatedTotal = PENDING.filter((p) => selected.has(p.id)).reduce(
    (s, p) => s + p.amount,
    0,
  );
  const projected = STARTING_BALANCE - simulatedTotal;
  const projectedPct = (projected / STARTING_BALANCE) * 100;
  const inCritical = projected < CRITICAL_BUFFER;
  const wouldOverdraw = projected < 0;

  const zoneTone = wouldOverdraw
    ? "text-red-700 bg-red-600"
    : inCritical
      ? "text-white bg-red-500"
      : projected < STARTING_BALANCE * 0.3
        ? "text-white bg-amber-500"
        : "text-white bg-emerald-500";
  const zoneLabel = wouldOverdraw
    ? "REJECTED BY FINANCE"
    : inCritical
      ? "CRITICAL BUFFER ZONE"
      : projected < STARTING_BALANCE * 0.3
        ? "TIGHT · MONITOR"
        : "SAFE";

  // Gauge arc
  const clampedPct = Math.max(0, Math.min(100, projectedPct));

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="ORS Sandbox · Overrun Prevention"
        subtitle="Simulate an Obligation Request before submission to Finance"
        actions={
          <>
            <Btn icon={<RefreshCw size={13} />} label="Reset Simulation" />
            <Btn
              icon={<FileText size={13} />}
              label="Submit to Finance ORS"
              variant="primary"
              disabled={wouldOverdraw || inCritical}
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Current Balance"
          value={peso(STARTING_BALANCE)}
          trend="Programmatic Bucket · Engineering"
          tone="neutral"
        />
        <Stat
          label="Pending Requests"
          value={PENDING.length.toString()}
          trend="From your supervisors"
          tone="neutral"
        />
        <Stat
          label="Selected for Sim."
          value={selected.size.toString()}
          trend={`${peso(simulatedTotal)} total`}
          tone="neutral"
        />
        <Stat
          label="Critical Buffer"
          value={peso(CRITICAL_BUFFER)}
          trend="Reserved for emergencies"
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ReceiptText size={14} className="text-neutral-900" />
            <div className="text-[12.5px] font-medium text-neutral-900">
              Incoming Purchase Requests
            </div>
          </div>
          <div className="space-y-2">
            {PENDING.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`w-full text-left border rounded-lg p-3 transition ${isSel ? "border-indigo-400 bg-indigo-50/40" : "border-neutral-200 hover:border-neutral-300"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center ${isSel ? "bg-indigo-600 border-indigo-600" : "border-neutral-300 bg-white"}`}
                      >
                        {isSel && (
                          <CheckCircle2 size={10} className="text-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-neutral-900">
                          {r.title}
                        </div>
                        <div className="text-[10.5px] font-normal text-neutral-500">
                          {r.requester} · {r.site}
                        </div>
                        <span className="mt-1 inline-block text-[9px] font-medium uppercase bg-neutral-100 text-neutral-600 rounded px-1.5 py-0.5">
                          {r.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-[13px] font-semibold text-neutral-900 tabular-nums shrink-0">
                      {peso(r.amount)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gauge size={14} className="text-neutral-900" />
            <div className="text-[12.5px] font-medium text-neutral-900">
              Impact Gauge · After Approval
            </div>
          </div>

          <div className="relative flex flex-col items-center py-3">
            <svg viewBox="0 0 160 100" className="w-[240px] h-[140px]">
              {/* Critical zone red arc */}
              <path
                d="M 18 88 A 62 62 0 0 1 32 50"
                stroke="#fee2e2"
                strokeWidth="14"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 32 50 A 62 62 0 0 1 80 18"
                stroke="#fef3c7"
                strokeWidth="14"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 80 18 A 62 62 0 0 1 142 88"
                stroke="#d1fae5"
                strokeWidth="14"
                fill="none"
                strokeLinecap="round"
              />
              {/* Needle */}
              {(() => {
                const angle = Math.PI * (1 - clampedPct / 100);
                const nx = 80 + 58 * Math.cos(angle);
                const ny = 88 - 58 * Math.sin(angle);
                return (
                  <>
                    <line
                      x1="80"
                      y1="88"
                      x2={nx}
                      y2={ny}
                      stroke={
                        wouldOverdraw
                          ? "#dc2626"
                          : inCritical
                            ? "#dc2626"
                            : projected < STARTING_BALANCE * 0.3
                              ? "#f59e0b"
                              : "#10b981"
                      }
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <circle cx="80" cy="88" r="5" fill="#171717" />
                  </>
                );
              })()}
              <text
                x="20"
                y="98"
                className="text-[7px] font-medium"
                fill="#dc2626"
              >
                ₱0
              </text>
              <text
                x="130"
                y="98"
                className="text-[7px] font-medium"
                fill="#10b981"
              >
                {pesoShort(STARTING_BALANCE)}
              </text>
            </svg>

            <div className="text-center mt-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Projected Remaining
              </div>
              <div
                className={`text-[24px] font-semibold tabular-nums ${wouldOverdraw ? "text-red-700" : inCritical ? "text-red-600" : "text-neutral-900"}`}
              >
                {peso(projected)}
              </div>
              <span
                className={`mt-2 inline-block text-[9.5px] font-medium uppercase tracking-wider rounded px-2 py-1 ${zoneTone}`}
              >
                {zoneLabel}
              </span>
            </div>
          </div>

          {(inCritical || wouldOverdraw) && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertOctagon
                size={13}
                className="text-red-700 mt-0.5 shrink-0"
              />
              <div className="text-[10.5px] font-normal text-red-900 leading-relaxed">
                {wouldOverdraw ? (
                  <>
                    <span className="font-medium">
                      This ORS will bounce.
                    </span>{" "}
                    Projected balance is negative — Finance will reject
                    submission. Reduce scope by {peso(-projected)} before
                    clicking Submit.
                  </>
                ) : (
                  <>
                    <span className="font-medium">
                      Critical buffer breached.
                    </span>{" "}
                    Only {peso(projected)} would remain for unforeseen
                    emergencies. Scale back the purchase order before Finance
                    reviews.
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-neutral-100 space-y-1.5 text-[10.5px] font-normal">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Starting balance</span>
              <span className="text-neutral-900 tabular-nums">
                {peso(STARTING_BALANCE)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Simulated draw</span>
              <span className="text-red-600 tabular-nums">
                − {peso(simulatedTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
              <span className="text-neutral-700 font-medium">
                Projected balance
              </span>
              <span
                className={`tabular-nums font-medium ${wouldOverdraw ? "text-red-700" : inCritical ? "text-red-600" : "text-neutral-900"}`}
              >
                {peso(projected)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 18.1.C — LEADER EXPENSE REPORTS ====================
