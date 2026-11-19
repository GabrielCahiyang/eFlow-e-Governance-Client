import * as Lucide from "lucide-react";
import * as React from "react";
import * as Carbon from "@carbon/icons-react";
import * as UI from "./CommitteePrimitives";

const treasuryFunds = [
  { fund: "General Fund — Unappropriated", available: 142_500_000, status: "Available" },
  { fund: "Calamity Fund (20% Reserve)", available: 67_500_000, status: "Available" },
  { fund: "Special Education Fund", available: 28_000_000, status: "Available" },
  { fund: "Gender & Development Fund", available: 15_200_000, status: "Available" },
  { fund: "Local DRRM Fund (Remaining)", available: 8_500_000, status: "Insufficient" },
];

const draftOrdinanceText = `ORDINANCE NO. 2026-___

AN ORDINANCE APPROPRIATING THE SUM OF TEN MILLION PESOS (₱10,000,000.00) FOR THE ESTABLISHMENT OF THE ORMOC CITY DIGITAL GOVERNANCE AND eFLOW IMPLEMENTATION FUND

Be it ordained by the Sangguniang Panlungsod of the City of Ormoc, in session assembled:

SECTION 1. Short Title. — This ordinance shall be known as the "eFlow Digital Governance Fund Ordinance of 2026."

SECTION 2. Purpose. — To establish a dedicated fund for the implementation of the eFlow Digital Governance Platform, including:
  a) Cloud infrastructure and hosting services
  b) AI/ML model training and deployment
  c) Blockchain node maintenance and cryptographic ledger operations
  d) Staff training and digital literacy programs
  e) Hardware procurement for department terminals

SECTION 3. Appropriation. — An amount of TEN MILLION PESOS (₱10,000,000.00) is hereby appropriated from the General Fund — Unappropriated Balance for FY 2026.

SECTION 4. Fund Management. — The City Treasurer shall manage the fund in accordance with existing COA regulations and the City's Financial Management Code.

SECTION 5. Reporting. — Quarterly utilization reports shall be submitted to the Committee on Appropriations & Finance.

SECTION 6. Effectivity. — This ordinance shall take effect fifteen (15) days after its publication.`;

export function BudgetLegislation() {
  const [editorText, setEditorText] = React.useState(draftOrdinanceText);
  const [appropriationAmount, setAppropriationAmount] = React.useState(10_000_000);
  const selectedFund = treasuryFunds[0]; // General Fund
  const isOverBudget = appropriationAmount > selectedFund.available;
  const isFundSufficient = !isOverBudget;

  // Detect appropriation amount from text
  React.useEffect(() => {
    const match = editorText.match(/(?:₱|PHP?\s*)([\d,]+(?:\.\d{2})?)/);
    if (match) {
      const num = parseInt(match[1].replace(/,/g, ""));
      if (!isNaN(num) && num > 0) setAppropriationAmount(num);
    }
  }, [editorText]);

  return (
    <div>
      <UI.PageHeader
        title="Appropriation Drafting"
        subtitle="Committee on Appropriations & Finance"
        actions={
          <>
            <UI.Btn icon={<Carbon.Locked size={14} />} label="Live Link: Treasury General Fund" variant="success" />
            <UI.Btn icon={<Carbon.CheckmarkOutline size={14} />} label="Submit Favorable Report" variant="primary" disabled={isOverBudget} />
          </>
        }
      />

      {/* Fiscal Alert */}
      {isOverBudget && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <Lucide.AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-red-800">Unfunded Mandate Detected</p>
            <p className="text-[12px] font-normal text-red-700 mt-1">
              The appropriation amount of ₱{appropriationAmount.toLocaleString()} exceeds the available balance of ₱{selectedFund.available.toLocaleString()} in the {selectedFund.fund}. The Submit button is disabled until the amount is corrected or an alternative fund source is identified.
            </p>
          </div>
        </div>
      )}

      {/* Split View */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        {/* Left: Text Editor */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50/50">
            <div className="flex items-center gap-2">
              <Lucide.Edit3 size={14} className="text-neutral-500" />
              <span className="text-[12px] font-semibold text-neutral-700">Ordinance Draft Editor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-normal text-neutral-400">Auto-saved 30s ago</span>
              <div className="size-2 rounded-full bg-emerald-400" />
            </div>
          </div>
          <div className="p-5">
            <textarea
              maxLength={50000}
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              className={`w-full min-h-[520px] bg-transparent text-[13px] font-normal text-neutral-700 leading-relaxed outline-none resize-none ${
                isOverBudget ? "selection:bg-red-100" : ""
              }`}
              style={{ whiteSpace: "pre-wrap" }}
            />
          </div>
          {/* Highlight warning bar */}
          {isOverBudget && (
            <div className="px-5 py-3 bg-red-50 border-t border-red-200 flex items-center gap-2">
              <Carbon.Warning size={14} className="text-red-500" />
              <span className="text-[11px] font-medium text-red-700">
                ₱{appropriationAmount.toLocaleString()} exceeds available ₱{selectedFund.available.toLocaleString()} — Text flagged in red
              </span>
            </div>
          )}
        </div>

        {/* Right: Treasury Live Feed */}
        <div className="flex flex-col gap-4">
          {/* Live Treasury Connection */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[12px] font-semibold text-neutral-900">City Treasury — Live Ledger</span>
            </div>
            <p className="text-[10px] font-normal text-neutral-400 mb-3">
              Real-time fund availability via blockchain API
            </p>
            <div className="flex flex-col gap-2">
              {treasuryFunds.map((f, i) => (
                <div key={i} className={`p-3 rounded-lg border ${f.status === "Insufficient" ? "border-red-200 bg-red-50/50" : "border-neutral-100 bg-neutral-50/30"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-neutral-700">{f.fund}</span>
                    <UI.Pill status={f.status} />
                  </div>
                  <span className="text-[16px] font-semibold text-neutral-900">₱{f.available.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fiscal Math Box */}
          <div className={`rounded-xl border p-5 ${isFundSufficient ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <h4 className={`text-[12px] font-semibold mb-3 ${isFundSufficient ? "text-emerald-800" : "text-red-800"}`}>
              Fiscal Gatekeeper Check
            </h4>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-[11px] font-normal text-neutral-600">Requested Amount</span>
                <span className="text-[11px] font-semibold text-neutral-900">₱{appropriationAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] font-normal text-neutral-600">Available (General Fund)</span>
                <span className="text-[11px] font-semibold text-neutral-900">₱{selectedFund.available.toLocaleString()}</span>
              </div>
              <div className="h-px bg-neutral-200 my-1" />
              <div className="flex justify-between">
                <span className="text-[11px] font-normal text-neutral-600">Remaining After</span>
                <span className={`text-[11px] font-semibold ${isFundSufficient ? "text-emerald-700" : "text-red-700"}`}>
                  ₱{(selectedFund.available - appropriationAmount).toLocaleString()}
                </span>
              </div>
            </div>
            <div className={`mt-3 flex items-center gap-1.5 text-[11px] font-medium ${isFundSufficient ? "text-emerald-700" : "text-red-700"}`}>
              {isFundSufficient ? <Lucide.Check size={14} /> : <Lucide.X size={14} />}
              {isFundSufficient ? "Funds verified — Submit enabled" : "Insufficient funds — Submit disabled"}
            </div>
          </div>

          {/* Blockchain Verification */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Carbon.Locked size={12} className="text-neutral-500" />
              <span className="text-[11px] font-semibold text-neutral-700">Blockchain Sync</span>
            </div>
            <p className="text-[10px] font-normal text-neutral-500">
              Last treasury block: #48,294 · Synced 8s ago · All balances hash-verified
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 8.2.A COMMITTEE CHAIRMANSHIPS ====================
