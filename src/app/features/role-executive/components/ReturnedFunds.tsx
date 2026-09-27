import * as React from "react";
import * as Carbon from "@carbon/icons-react";
import * as Charts from "recharts";
import * as UI from "./AuditPrimitives";
import { returnedFunds } from "./auditData";

export function ReturnedFunds() {
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);

  const totalOriginal = returnedFunds.reduce((s, r) => s + r.original, 0);
  const totalLiquidated = returnedFunds.reduce((s, r) => s + r.liquidated, 0);
  const totalReturned = returnedFunds.reduce((s, r) => s + r.returned, 0);
  const sealedCount = returnedFunds.filter(r => r.cycleStatus === "Cycle Sealed").length;
  const mismatchCount = returnedFunds.filter(r => r.cycleStatus === "Audit Mismatch").length;

  return (
    <div>
      <UI.PageHeader
        title="Treasury Returns Log"
        subtitle="Cryptographic Ledger · Returned Funds"
        actions={<>
          <UI.Btn icon={<Carbon.Renew size={14} />} label="Reconcile Cycle" variant="primary" />
          <UI.Btn icon={<Carbon.Download size={14} />} label="Export" />
        </>}
      />
      <UI.ReadOnlyBanner />

      <div className="flex gap-3 mb-5 flex-wrap">
        <UI.StatCard label="Total Cycles" value={`${returnedFunds.length}`} sub="Fund lifecycle records" />
        <UI.StatCard label="Cycles Sealed" value={`${sealedCount}`} sub="Math balanced + Treasury signed" trend="up" />
        <UI.StatCard label="Audit Mismatches" value={`${mismatchCount}`} sub="Discrepancies detected" trend="down" />
        <UI.StatCard label="Total Returned" value={`₱${(totalReturned / 1000).toFixed(1)}K`} sub="Cash back to Treasury" />
      </div>

      {/* Architecture explanation */}
      <div className="mb-5 rounded-[14px] border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Carbon.Security size={20} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <h4 className="mb-1 text-[13px] font-semibold text-foreground">Why This Matters: The Closed-Loop Guarantee</h4>
            <p className="text-[11px] font-normal leading-relaxed text-secondary-foreground">
              Every peso follows a sealed lifecycle: <span className="text-secondary-foreground">₱Advanced</span> → <span className="text-emerald-700">₱Liquidated</span> → <span className="text-primary">₱Returned</span>. The logic engine enforces that <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-foreground">Original − Liquidated = Returned</span>. If even a ₱1 discrepancy exists, the blockchain <strong className="text-destructive">refuses</strong> to seal the cycle, and a Tamper Alert is dispatched to the Mayor's Office.
            </p>
          </div>
        </div>
      </div>

      {/* Cycle visualization */}
      <div className="mb-5 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <h3 className="text-[13px] font-semibold text-neutral-900 mb-3">Fund Lifecycle Overview</h3>
        <Charts.ResponsiveContainer width="100%" height={220}>
          <Charts.BarChart data={returnedFunds.map(r => ({
            payee: r.payee.split(" ")[1],
            original: r.original / 1000,
            liquidated: r.liquidated / 1000,
            returned: r.returned / 1000,
            mismatch: r.cycleStatus === "Audit Mismatch",
          }))}>
            <Charts.CartesianGrid key="g" strokeDasharray="3 3" stroke="#f0f0f0" />
            <Charts.XAxis key="x" dataKey="payee" tick={{ fontSize: 11 }} />
            <Charts.YAxis key="y" tick={{ fontSize: 11 }} />
            <Charts.Tooltip key="t" formatter={(value: number) => `₱${value}K`} />
            <Charts.Legend key="l" wrapperStyle={{ fontSize: 11 }} />
            <Charts.Bar key="b1" dataKey="original" fill="#94A3B8" name="Original (₱K)" radius={[2, 2, 0, 0]} />
            <Charts.Bar key="b2" dataKey="liquidated" fill="#10B981" name="Liquidated (₱K)" radius={[2, 2, 0, 0]} />
            <Charts.Bar key="b3" dataKey="returned" fill="#0c6f6b" name="Returned (₱K)" radius={[2, 2, 0, 0]} />
          </Charts.BarChart>
        </Charts.ResponsiveContainer>
      </div>

      {/* The Closed-Loop Board */}
      <div className="overflow-x-auto rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <div className="grid min-w-[900px] grid-cols-[90px_130px_110px_110px_110px_110px_130px_100px] gap-0 border-b border-border bg-muted/40 px-5 py-3">
          {["Ref ID", "Payee", "Original", "Liquidated", "Returned", "Expected", "Cycle Status", "BC Seal"].map(h => (
            <span key={h} className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {returnedFunds.map((r) => {
          const isMismatch = r.cycleStatus === "Audit Mismatch";
          const discrepancy = r.returned - r.expected;
          const isExpanded = expandedRow === r.id;
          return (
            <React.Fragment key={r.id}>
              <div
                onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                className={`grid min-w-[900px] grid-cols-[90px_130px_110px_110px_110px_110px_130px_100px] items-center gap-0 border-b px-5 py-3.5 transition-all cursor-pointer ${
                  isMismatch ? "bg-red-50/50 border-b-red-100 hover:bg-red-50/70 border-l-4 border-l-red-500" :
                  "border-b-neutral-50 hover:bg-neutral-50/50"
                }`}
              >
                <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] text-neutral-500">{r.advanceRef.slice(-7)}</span>
                <span className="text-[12px] font-medium text-neutral-900">{r.payee}</span>
                <span className="text-[12px] font-medium text-neutral-900">₱{r.original.toLocaleString()}</span>
                <span className="text-[12px] font-normal text-emerald-700">₱{r.liquidated.toLocaleString()}</span>
                <span className={`text-[12px] font-semibold ${isMismatch ? "text-red-600" : "text-violet-700"}`}>₱{r.returned.toLocaleString()}</span>
                <span className="text-[12px] font-normal text-neutral-600">₱{r.expected.toLocaleString()}</span>
                <UI.Pill status={r.cycleStatus} />
                <div className="flex items-center justify-center">
                  {r.sealed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                      <Carbon.Locked size={11} className="text-blue-500" />
                      <span className="text-[10px] font-medium text-blue-700">Sealed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                      <Carbon.Warning size={11} className="text-red-500" />
                      <span className="text-[10px] font-medium text-red-700">Refused</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className={`px-8 py-5 border-b ${isMismatch ? "bg-red-50/30 border-b-red-100" : "bg-slate-50/30 border-b-neutral-100"}`}>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Math verification */}
                    <div>
                      <h4 className="text-[12px] font-semibold text-neutral-900 mb-3">Closed-Loop Arithmetic</h4>
                      <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-normal text-neutral-600">Original Advanced</span>
                          <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[13px] text-blue-600">₱{r.original.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-normal text-neutral-600">− Liquidated Amount</span>
                          <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[13px] text-emerald-600">₱{r.liquidated.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-neutral-200 pt-2 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-neutral-900">= Expected Return</span>
                          <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[13px] text-neutral-900">₱{r.expected.toLocaleString()}</span>
                        </div>
                        <div className={`flex items-center justify-between p-2 rounded-lg ${isMismatch ? "bg-red-50" : "bg-emerald-50"}`}>
                          <span className={`text-[11px] font-semibold ${isMismatch ? "text-red-700" : "text-emerald-700"}`}>Actual Returned</span>
                          <span className={`font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[13px] ${isMismatch ? "text-red-600" : "text-emerald-600"}`}>₱{r.returned.toLocaleString()}</span>
                        </div>
                        {isMismatch && (
                          <div className="bg-red-100 rounded-lg p-3 flex items-center gap-2">
                            <Carbon.Warning size={14} className="text-red-600 shrink-0" />
                            <span className="text-[11px] font-normal text-red-700">
                              Discrepancy of <strong className="font-['JetBrains_Mono',_'Fira_Code',_monospace]">₱{Math.abs(discrepancy).toLocaleString()}</strong> detected. Blockchain has refused to seal this cycle.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Seal status */}
                    <div className="flex flex-col items-center justify-center">
                      {isMismatch ? (
                        <div className="flex flex-col items-center gap-3 rounded-[14px] border-2 border-red-300 bg-red-50 px-8 py-6">
                          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                            <Carbon.Warning size={28} className="text-red-600" />
                          </div>
                          <span className="text-[14px] font-semibold text-red-700">AUDIT MISMATCH</span>
                          <span className="text-[10px] font-normal text-red-600 text-center">₱{Math.abs(discrepancy)} discrepancy. Tamper Alert auto-dispatched to Mayor's Office.</span>
                          <span className="text-[9px] font-normal text-neutral-500 mt-1">Treasury digital signature: WITHHELD</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 rounded-[14px] border-2 border-primary/30 bg-primary/5 px-8 py-6">
                          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                            <Carbon.Security size={28} className="text-primary" />
                          </div>
                          <span className="text-[14px] font-semibold text-primary">CYCLE SEALED</span>
                          <span className="text-[10px] font-normal text-primary/80 text-center">Math balanced. Treasury digitally signed.</span>
                          <UI.HashDisplay hash={r.hash} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Cycle completion pie */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <h3 className="text-[13px] font-semibold text-neutral-900 mb-3">Cycle Completion Rate</h3>
          <Charts.ResponsiveContainer width="100%" height={180}>
            <Charts.PieChart>
              <Charts.Pie key="pie" data={[
                { name: "Sealed", value: sealedCount },
                { name: "Mismatch", value: mismatchCount },
              ]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
              <Charts.Cell key="s" fill="#0c6f6b" />
                <Charts.Cell key="m" fill="#EF4444" />
              </Charts.Pie>
              <Charts.Tooltip key="t" />
            </Charts.PieChart>
          </Charts.ResponsiveContainer>
        </div>

        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <h3 className="text-[13px] font-semibold text-neutral-900 mb-3">Fund Flow Reconciliation</h3>
          <div className="space-y-4 mt-4">
            {[
              { label: "Total Advanced", value: totalOriginal, color: "bg-slate-400" },
              { label: "Total Liquidated", value: totalLiquidated, color: "bg-emerald-400" },
              { label: "Total Returned", value: totalReturned, color: "bg-primary" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-neutral-600">{item.label}</span>
                  <span className="text-[12px] font-semibold text-neutral-900">₱{(item.value / 1000).toFixed(1)}K</span>
                </div>
                <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / totalOriginal) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="border-t border-neutral-200 pt-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-900">Unaccounted</span>
              <span className={`text-[12px] font-semibold ${(totalOriginal - totalLiquidated - totalReturned) === 0 ? "text-emerald-600" : "text-red-600"}`}>
                ₱{((totalOriginal - totalLiquidated - totalReturned) / 1000).toFixed(1)}K
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
