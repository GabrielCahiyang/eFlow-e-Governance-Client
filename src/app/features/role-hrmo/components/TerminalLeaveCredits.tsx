import { useState } from "react";
import { DollarSign, Download, Search } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

type LeaveRow = {
  id: number;
  name: string;
  position: string;
  dept: string;
  vac: number;
  sick: number;
  special: number;
  monetizable: boolean;
  lastAutoApproved?: string;
};

const LEAVE_DATA: LeaveRow[] = [
  { id: 1, name: "Arnel Dela Cruz", position: "Sr. Civil Engineer", dept: "Engineering", vac: 28.5, sick: 42.0, special: 3.0, monetizable: true, lastAutoApproved: "2026-04-18" },
  { id: 2, name: "Maria Sabando", position: "Health Officer II", dept: "Health", vac: 12.0, sick: 18.5, special: 0, monetizable: false, lastAutoApproved: "2026-04-12" },
  { id: 3, name: "Patricia Odal", position: "City Planning Arch.", dept: "Planning", vac: 35.0, sick: 38.0, special: 5.0, monetizable: true, lastAutoApproved: "2026-03-28" },
  { id: 4, name: "Juanito Pomentil", position: "Social Worker III", dept: "Social Welfare", vac: 8.5, sick: 22.0, special: 0, monetizable: false },
  { id: 5, name: "Carlos Villamor", position: "Treasury Analyst", dept: "Treasury", vac: 45.0, sick: 51.0, special: 10.0, monetizable: true, lastAutoApproved: "2026-04-02" },
  { id: 6, name: "Rey Alcantara", position: "CENRO Inspector", dept: "Environment", vac: 15.0, sick: 20.5, special: 2.0, monetizable: false, lastAutoApproved: "2026-04-15" },
  { id: 7, name: "Lynnette Bascon", position: "LEDIPO Coord.", dept: "LEDIPO", vac: 22.0, sick: 30.0, special: 0, monetizable: true },
  { id: 8, name: "Francis Lariosa", position: "Legal Counsel II", dept: "Legal", vac: 9.5, sick: 14.0, special: 0, monetizable: false, lastAutoApproved: "2026-04-10" },
];

export function TerminalLeaveCredits() {
  const [query, setQuery] = useState("");
  const filtered = LEAVE_DATA.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()) || r.dept.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <PageHeader
        title="City-Wide Leave Balances"
        subtitle="Mobile auto-approval ledger · zero paperwork · BPA-audited"
        actions={
          <>
            <Btn icon={<Download size={14} />} label="Export: COA Audit Report" />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="Total Employees" value="2,068" trend="active leave credits" />
        <Stat label="Auto-Approvals · 30d" value="1,284" trend="zero HR touch" tone="good" />
        <Stat label="Manual Reviews" value="6" trend="flagged by BPA" tone="warn" />
        <Stat label="Avg Approval Time" value="4.2s" trend="from mobile submit" tone="good" />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-3">
          <Search size={14} className="text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee or department..."
            maxLength={120}
            className="flex-1 text-[13px] font-normal bg-transparent outline-none placeholder:text-neutral-400"
          />
          <span className="text-[11px] font-normal text-neutral-400">{filtered.length} of {LEAVE_DATA.length}</span>
        </div>
        <div className="grid grid-cols-12 px-5 py-3 bg-neutral-50 border-b border-neutral-200 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
          <div className="col-span-3">Employee</div>
          <div className="col-span-2">Department</div>
          <div className="col-span-1 text-right">Vacation</div>
          <div className="col-span-1 text-right">Sick</div>
          <div className="col-span-1 text-right">Special</div>
          <div className="col-span-2">Last Auto-Approved</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {filtered.map((r) => (
          <div key={r.id} className="grid grid-cols-12 px-5 py-3 border-b border-neutral-100 last:border-0 items-center text-[12px] font-normal hover:bg-neutral-50 transition-colors">
            <div className="col-span-3">
              <div className="font-medium text-neutral-900">{r.name}</div>
              <div className="text-[10px] text-neutral-400">{r.position}</div>
            </div>
            <div className="col-span-2 text-neutral-600">{r.dept}</div>
            <div className="col-span-1 text-right font-medium tabular-nums">{r.vac.toFixed(1)}</div>
            <div className="col-span-1 text-right font-medium tabular-nums">{r.sick.toFixed(1)}</div>
            <div className="col-span-1 text-right font-medium tabular-nums">{r.special.toFixed(1)}</div>
            <div className="col-span-2 text-neutral-500">{r.lastAutoApproved || "—"}</div>
            <div className="col-span-2 text-right">
              {r.monetizable ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-medium">
                  <DollarSign size={9} /> Monetizable
                </span>
              ) : (
                <span className="text-[10px] text-neutral-400">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 10.2.B — MONETIZATION ====================
