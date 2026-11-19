import * as Lucide from "lucide-react";
import * as React from "react";
import * as Carbon from "@carbon/icons-react";
import * as UI from "./CommitteePrimitives";

interface DocVersion {
  id: string;
  author: string;
  initials: string;
  action: string;
  timestamp: string;
  detail: string;
}

const docVersions: DocVersion[] = [
  { id: "v1", author: "Hon. R. Almario", initials: "RA", action: "Added", timestamp: "Apr 14, 3:45 PM", detail: "Added penalty clause: Section 7 — Fines for non-compliance" },
  { id: "v2", author: "SP Secretariat (A. Villanueva)", initials: "AV", action: "Formatted", timestamp: "Apr 14, 2:10 PM", detail: "Applied standard ordinance formatting template" },
  { id: "v3", author: "Hon. L. Santos", initials: "LS", action: "Revised", timestamp: "Apr 14, 11:30 AM", detail: "Changed appropriation from ₱8M to ₱5M per fiscal note" },
  { id: "v4", author: "NLP Engine", initials: "AI", action: "Flagged", timestamp: "Apr 14, 11:00 AM", detail: "Cross-check: Reference to RA 9003 in Section 2(c) is outdated — suggest RA 11898" },
  { id: "v5", author: "Hon. M. Delgado", initials: "MD", action: "Created", timestamp: "Apr 13, 9:00 AM", detail: "Initial draft submitted for committee deliberation" },
];

const collaborators = [
  { name: "Hon. R. Almario", initials: "RA", color: "bg-blue-500", active: true },
  { name: "Hon. L. Santos", initials: "LS", color: "bg-emerald-500", active: true },
  { name: "A. Villanueva (Secretariat)", initials: "AV", color: "bg-violet-500", active: true },
  { name: "Hon. M. Delgado", initials: "MD", color: "bg-amber-500", active: false },
];

const workingDocText = `ORDINANCE NO. 2026-___

AN ORDINANCE APPROPRIATING THE SUM OF FIVE MILLION PESOS (₱5,000,000.00) FOR THE MARINE LITTER INTERCEPTION PROGRAM OF ORMOC CITY (#SHInEOrmoc Phase 2)

Author: Hon. M. Delgado
Committee: Tourism & Environment
Status: Under Committee Deliberation

EXPLANATORY NOTE

The Ormoc City Solid Waste Management Board has reported that approximately 2,400 metric tons of marine litter enter the Ormoc Bay watershed annually. The #SHInEOrmoc initiative (Solid Waste Handling & Interception Network) has successfully reduced land-based littering by 34% since ORD-2025-035 was enacted.

Phase 2 focuses on:
  (a) Installation of 12 trash trap interceptors at major drainage outfalls
  (b) Deployment of 3 solar-powered river skimmer units
  (c) Establishment of a community-based litter monitoring network across 8 coastal barangays
  (d) Public awareness campaign and school engagement program

BE IT ORDAINED by the Sangguniang Panlungsod of the City of Ormoc, in session assembled:

SECTION 1. Short Title. — This ordinance shall be known as the "#SHInEOrmoc Phase 2 Appropriation Ordinance."

SECTION 2. Appropriation. — The sum of FIVE MILLION PESOS (₱5,000,000.00) is hereby appropriated from the General Fund for the implementation of the Marine Litter Interception Program.

SECTION 3. Implementation. — The City Environment and Natural Resources Office (CENRO), in coordination with the City Engineering Office, shall implement the program components within twelve (12) months from effectivity.

SECTION 4. Monitoring. — Quarterly progress reports shall be submitted to the Committee on Tourism & Environment.

SECTION 5. Separability Clause. — If any provision of this Ordinance is declared unconstitutional or invalid, the remaining provisions shall continue in full force and effect.

SECTION 6. Repealing Clause. — All ordinances, rules, and regulations inconsistent herewith are hereby repealed or modified accordingly.

SECTION 7. Penalties. — Any person or entity found violating the provisions of this ordinance shall be penalized as follows:
  (a) First Offense: Fine of ₱5,000.00
  (b) Second Offense: Fine of ₱10,000.00 and community service
  (c) Third Offense: Fine of ₱25,000.00 and imprisonment of not more than thirty (30) days

SECTION 8. Effectivity. — This ordinance shall take effect fifteen (15) days after its complete publication in a newspaper of general circulation.`;

export function WorkingDocuments() {
  const [text, setText] = React.useState(workingDocText);
  const [aiCheck, setAiCheck] = React.useState(true);
  const [showAdopt, setShowAdopt] = React.useState(false);

  return (
    <div>
      <UI.PageHeader
        title="Collaborative Drafting"
        subtitle="Committee on Tourism & Environment · ORD-2026-044"
        actions={
          <>
            <button
              onClick={() => setAiCheck(!aiCheck)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer transition-colors ${
                aiCheck ? "bg-violet-100 text-violet-700 border border-violet-200" : "bg-white text-neutral-600 border border-neutral-200"
              }`}
            >
              <Lucide.Zap size={14} /> AI Legal Cross-Check: {aiCheck ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setShowAdopt(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer transition-colors bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Carbon.CheckmarkOutline size={14} /> Adopt Committee Report
            </button>
          </>
        }
      />

      {/* Collaborators Bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 px-5 py-3 mb-5">
        <div className="flex items-center gap-3">
          <Lucide.Users size={14} className="text-neutral-500" />
          <span className="text-[12px] font-medium text-neutral-700">Live Collaborators</span>
          <div className="flex -space-x-2">
            {collaborators.filter(c => c.active).map((c, i) => (
              <div key={i} className={`size-7 rounded-full ${c.color} flex items-center justify-center border-2 border-white`} title={c.name}>
                <span className="text-[9px] text-white font-semibold">{c.initials}</span>
              </div>
            ))}
          </div>
          <span className="text-[10px] font-normal text-neutral-400">
            {collaborators.filter(c => c.active).length} editing now
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-normal text-neutral-500">All changes auto-saved</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        {/* Editor */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50/50">
            <div className="flex items-center gap-2">
              <Lucide.FileText size={14} className="text-neutral-500" />
              <span className="text-[12px] font-semibold text-neutral-700">ORD-2026-044 — Marine Litter Interception</span>
              <UI.Pill status="Under Review" />
            </div>
          </div>

          {/* AI Flag Banner */}
          {aiCheck && (
            <div className="px-5 py-2.5 bg-violet-50 border-b border-violet-100 flex items-start gap-2">
              <Lucide.Zap size={12} className="text-violet-600 mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] font-semibold text-violet-700">AI Legal Cross-Check Active</span>
                <p className="text-[10px] font-normal text-violet-600 mt-0.5">
                  1 flag: Reference to RA 9003 in Section 2(c) may be outdated — consider updating to RA 11898 (Extended Producer Responsibility Act of 2022)
                </p>
              </div>
            </div>
          )}

          <div className="p-5">
            <textarea
              maxLength={50000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-[560px] bg-transparent text-[13px] font-normal text-neutral-700 leading-relaxed outline-none resize-none"
              style={{ whiteSpace: "pre-wrap" }}
            />
          </div>
        </div>

        {/* Version History + Collaborator Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Version Control Timeline */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="text-[13px] font-semibold text-neutral-900 mb-4">Version History</h4>
            <div className="flex flex-col gap-0">
              {docVersions.map((v, i) => {
                const isAI = v.initials === "AI";
                return (
                  <div key={v.id} className="flex gap-3 relative">
                    {/* Timeline Line */}
                    {i < docVersions.length - 1 && (
                      <div className="absolute left-[15px] top-[32px] bottom-0 w-px bg-neutral-200" />
                    )}
                    <div className={`size-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      isAI ? "bg-violet-100" : "bg-blue-100"
                    }`}>
                      <span className={`text-[9px] font-semibold ${isAI ? "text-violet-700" : "text-blue-700"}`}>{v.initials}</span>
                    </div>
                    <div className="pb-5 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-semibold text-neutral-900">{v.author}</span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          v.action === "Added" ? "bg-emerald-100 text-emerald-700"
                          : v.action === "Revised" ? "bg-amber-100 text-amber-700"
                          : v.action === "Flagged" ? "bg-violet-100 text-violet-700"
                          : v.action === "Created" ? "bg-blue-100 text-blue-700"
                          : "bg-neutral-100 text-neutral-600"
                        }`}>
                          {v.action}
                        </span>
                      </div>
                      <p className="text-[11px] font-normal text-neutral-600 leading-relaxed">{v.detail}</p>
                      <p className="text-[9px] font-normal text-neutral-400 mt-1">{v.timestamp}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="text-[13px] font-semibold text-neutral-900 mb-3">Document Info</h4>
            <div className="flex flex-col gap-2.5">
              {[
                ["Tracking No.", "ORD-2026-044"],
                ["Author", "Hon. M. Delgado"],
                ["Committee", "Tourism & Environment"],
                ["Date Filed", "Mar 12, 2026"],
                ["Current Stage", "Committee Level"],
                ["Appropriation", "₱5,000,000"],
                ["Total Revisions", "5"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[10px] font-normal text-neutral-500">{k}</span>
                  <span className="text-[10px] font-semibold text-neutral-900">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BPA Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Lucide.Zap size={14} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-blue-800 mb-1">BPA Engine Ready</p>
                <p className="text-[10px] font-normal text-blue-700 leading-relaxed">
                  Clicking "Adopt Committee Report" will trigger the BPA Engine to automatically move this measure to the Plenary Agenda for the next Tuesday session.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Adopt Committee Report Modal */}
      {showAdopt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.25)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-2xl mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Carbon.CheckmarkOutline size={24} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-neutral-900">Adopt Committee Report?</h3>
                <p className="text-[12px] font-normal text-neutral-500">This action is recorded on the blockchain</p>
              </div>
            </div>
            <div className="bg-neutral-50 rounded-lg p-4 mb-4">
              <p className="text-[11px] font-normal text-neutral-500 mb-1">MEASURE</p>
              <p className="text-[12px] font-medium text-neutral-900">ORD-2026-044 — Marine Litter Interception Program</p>
              <p className="text-[11px] font-normal text-neutral-500 mt-2 mb-1">NEXT STEP</p>
              <p className="text-[12px] font-medium text-emerald-700">→ Plenary Agenda (Second Reading)</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdopt(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 rounded-lg text-[13px] font-medium cursor-pointer hover:bg-neutral-200 transition-colors">
                Cancel
              </button>
              <button onClick={() => setShowAdopt(false)} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-[13px] font-medium cursor-pointer hover:bg-emerald-700 transition-colors">
                Confirm & Adopt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
