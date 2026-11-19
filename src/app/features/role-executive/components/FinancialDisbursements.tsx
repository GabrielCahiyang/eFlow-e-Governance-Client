import * as React from "react";
import * as Carbon from "@carbon/icons-react";
import * as UI from "./AuditPrimitives";
import { disbursements } from "./auditData";

export function FinancialDisbursements() {
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [verifyState, setVerifyState] = React.useState<Record<string, "idle" | "checking" | "verified" | "mismatch">>({});
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleVerify = React.useCallback((id: string, tampered: boolean) => {
    setVerifyState(prev => ({ ...prev, [id]: "checking" }));
    setTimeout(() => {
      setVerifyState(prev => ({ ...prev, [id]: tampered ? "mismatch" : "verified" }));
    }, 1800);
  }, []);

  const filtered = disbursements.filter(d =>
    searchQuery === "" ||
    d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.payee.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <UI.PageHeader
        title="Sealed Disbursements"
        subtitle="Cryptographic Ledger · Financial Disbursements"
        actions={<>
          <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-lg px-3 py-1.5">
            <Carbon.Search size={14} className="text-neutral-400" />
            <input
              type="text"
              placeholder="Search voucher number…"
              maxLength={120}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-[12px] font-normal text-neutral-700 bg-transparent outline-none w-44 placeholder:text-neutral-400"
            />
          </div>
          <UI.Btn icon={<Carbon.DocumentExport size={14} />} label="COA Audit Log" variant="primary" />
        </>}
      />
      <UI.ReadOnlyBanner />

      <div className="flex gap-3 mb-5 flex-wrap">
        <UI.StatCard label="Total Disbursements" value={`${disbursements.length}`} sub="Sealed transactions" />
        <UI.StatCard label="Total Amount" value={`₱${(disbursements.reduce((s, d) => s + d.amount, 0) / 1e6).toFixed(1)}M`} sub="All outflows" />
        <UI.StatCard label="Verified" value={`${disbursements.filter(d => d.status === "Verified").length}`} sub="Hash match confirmed" trend="up" />
        <UI.StatCard label="Flagged" value={`${disbursements.filter(d => d.status === "Flagged").length}`} sub="Potential tampering" trend="down" />
      </div>

      {/* High-Density Hash Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="grid grid-cols-[90px_170px_1fr_120px_1fr_180px_70px] gap-0 px-5 py-3 bg-neutral-50/50 border-b border-neutral-100">
          {["Timestamp", "Payee / Target", "Amount", "BPA Origin Node", "Cryptographic Hash", "Status", ""].map(h => (
            <span key={h} className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {filtered.map((d) => {
          const isExpanded = expandedRow === d.id;
          const vState = verifyState[d.id] || "idle";
          const isTampered = d.tampered;
          return (
            <React.Fragment key={d.id}>
              <div
                onClick={() => setExpandedRow(isExpanded ? null : d.id)}
                className={`grid grid-cols-[90px_170px_1fr_120px_1fr_180px_70px] gap-0 px-5 py-3.5 border-b transition-all items-center cursor-pointer ${
                  isTampered ? "bg-red-50/40 border-b-red-100 hover:bg-red-50/60" : isExpanded ? "bg-blue-50/30 border-b-blue-100" : "border-b-neutral-50 hover:bg-neutral-50/50"
                }`}
              >
                <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] text-neutral-500">{d.timestamp.slice(5, 19)}</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-semibold text-white">
                    {d.initials}
                  </div>
                  <span className="text-[12px] font-medium text-neutral-900">{d.payee}</span>
                </div>
                <span className="text-[12px] font-semibold text-neutral-900">₱{d.amount.toLocaleString()}</span>
                <span className="text-[10px] font-normal text-neutral-600 leading-tight">{d.bpaOrigin}</span>
                <UI.HashDisplay hash={d.hash} />
                <UI.Pill status={d.status} />
                <div className="flex items-center justify-end">
                  {isExpanded ? <Carbon.ChevronDown size={14} className="text-neutral-400" /> : <Carbon.ChevronRight size={14} className="text-neutral-400" />}
                </div>
              </div>

              {/* Expanded verification panel */}
              {isExpanded && (
                <div className={`px-8 py-5 border-b ${isTampered ? "bg-red-50/20 border-b-red-100" : "bg-slate-50/50 border-b-neutral-100"}`}>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left: details */}
                    <div>
                      <h4 className="text-[12px] font-semibold text-neutral-900 mb-3">Transaction Details</h4>
                      <div className="space-y-2">
                        {[
                          ["Voucher ID", d.id],
                          ["Full Timestamp", d.timestamp],
                          ["Payee", d.payee],
                          ["Amount", `₱${d.amount.toLocaleString()}`],
                          ["BPA Workflow", d.bpaOrigin],
                        ].map(([label, val]) => (
                          <div key={label} className="flex items-start gap-3">
                            <span className="text-[10px] font-medium text-neutral-500 uppercase w-28 shrink-0">{label}</span>
                            <span className="text-[11px] font-normal text-neutral-800">{val}</span>
                          </div>
                        ))}
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-medium text-neutral-500 uppercase w-28 shrink-0">Blockchain Hash</span>
                          <UI.HashDisplay hash={d.hash} full />
                        </div>
                      </div>
                    </div>
                    {/* Right: integrity check */}
                    <div className="flex flex-col items-center justify-center">
                      {vState === "idle" && (
                        <div className="text-center">
                          <p className="text-[11px] font-normal text-neutral-600 mb-3">Click to re-calculate the hash of this database row and compare it to the blockchain record.</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleVerify(d.id, isTampered); }}
                            className="px-5 py-2.5 bg-slate-800 text-white rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
                          >
                            <Carbon.Security size={16} /> Verify Ledger Match
                          </button>
                        </div>
                      )}
                      {vState === "checking" && <UI.IntegrityShield status="checking" />}
                      {vState === "verified" && <UI.IntegrityShield status="verified" />}
                      {vState === "mismatch" && <UI.IntegrityShield status="mismatch" />}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 5.1B PROJECT LIQUIDATIONS ====================
