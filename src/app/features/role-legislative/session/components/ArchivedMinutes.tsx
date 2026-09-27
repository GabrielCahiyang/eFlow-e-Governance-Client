import React, { useState } from "react";
import { Analytics, Archive, DocumentExport, Download, Play, Search, View } from "@carbon/icons-react";
import { Btn, PageHeader, StatCard } from "./primitives";
import { archivedSessions } from "./sessionData";

interface SearchResult {
  session: string;
  date: string;
  timestamp: string;
  speaker: string;
  text: string;
  highlight: string;
  relevance: number;
}

const sampleSearchResults: SearchResult[] = [
  {
    session: "138th Regular Session",
    date: "2026-03-19",
    timestamp: "11:22:45",
    speaker: "Hon. M. Delgado",
    text: "Mr. Presiding Officer, I wish to bring to the attention of this body the alarming state of our beaches. The garbage collected from Brgy. Cogon alone fills three dump trucks per week. We need a systematic approach to beach garbage collection before the tourism season.",
    highlight: "beach garbage",
    relevance: 94,
  },
  {
    session: "136th Regular Session",
    date: "2026-03-05",
    timestamp: "14:08:12",
    speaker: "Hon. R. Almario",
    text: "The Eco-Park shoreline restoration project cannot proceed unless we address the marine debris problem. I have personally inspected the coastal area and the situation is dire — plastic waste from upstream barangays is destroying our coral rehabilitation efforts.",
    highlight: "marine debris",
    relevance: 89,
  },
  {
    session: "135th Regular Session",
    date: "2026-02-26",
    timestamp: "10:35:08",
    speaker: "Hon. L. Santos",
    text: "On the matter of the supplemental budget, I propose we allocate an additional ₱2.5 million for shore cleanup operations. The DENR has offered to co-fund this initiative if we demonstrate a local government match of at least 40%.",
    highlight: "shore cleanup operations",
    relevance: 78,
  },
  {
    session: "132nd Regular Session",
    date: "2026-02-05",
    timestamp: "15:15:33",
    speaker: "Hon. E. Lim",
    text: "I would like to move for a privilege speech regarding the waste management crisis in our coastal barangays. The tide brings in debris from neighboring municipalities and we have no mechanism to hold them accountable. This is fundamentally a regional problem that requires inter-LGU coordination.",
    highlight: "waste management crisis",
    relevance: 72,
  },
];

export function ArchivedMinutes() {
  const [searchQuery, setSearchQuery] = useState("coastal cleanup arguments");
  const [hasSearched, setHasSearched] = useState(true);

  return (
    <div>
      <PageHeader
        title="Historical Transcript Database"
        subtitle="Session Management · Archived Minutes (Semantic Search)"
        actions={<>
          <Btn icon={<Download size={14} />} label="Export Archive" />
        </>}
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Sessions Archived" value={`${archivedSessions.length + 2}`} sub="Full transcripts stored" />
        <StatCard label="Total Transcript Blocks" value="4,280" sub="NLP-indexed" trend="up" />
        <StatCard label="Speakers Indexed" value="18" sub="Across all sessions" />
        <StatCard label="Avg. Search Time" value="0.6s" sub="Semantic query" trend="up" />
      </div>

      {/* Semantic search */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Analytics size={20} className="text-violet-600" />
            <span className="text-[14px] font-semibold text-neutral-900">Semantic Transcript Search</span>
          </div>
          <p className="text-[11px] font-normal text-neutral-500 mb-4">
            Search using natural language. The AI understands context — searching "coastal cleanup" will also find "beach garbage," "marine debris," and "shore cleanup" across years of transcripts.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus-within:border-violet-300 focus-within:bg-white transition-colors">
              <Search size={18} className="text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='e.g. "Arguments about the coastal cleanup"'
                className="flex-1 bg-transparent outline-none text-[13px] font-normal text-neutral-800 placeholder:text-neutral-400"
              />
            </div>
            <button
              onClick={() => setHasSearched(true)}
              className="rounded-xl bg-primary px-5 py-3 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Search
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-normal text-neutral-400">Semantic expansion:</span>
            {["coastal cleanup", "beach garbage", "marine debris", "shore cleanup", "waste management"].map(term => (
              <span key={term} className="text-[9px] font-medium bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full border border-violet-100">{term}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Search results */}
      {hasSearched && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-normal text-neutral-500">{sampleSearchResults.length} results found across {[...new Set(sampleSearchResults.map(r => r.session))].length} sessions — 0.6 seconds</span>
          </div>

          {sampleSearchResults.map((result, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-violet-200 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-neutral-900">{result.session}</span>
                  <span className="text-[10px] font-normal text-neutral-500">{result.date}</span>
                  <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] text-violet-600">⏱ {result.timestamp}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${result.relevance}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-violet-600">{result.relevance}%</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-semibold text-white shrink-0 mt-0.5">
                  {result.speaker.split(" ").slice(-1)[0][0]}{result.speaker.split(" ").slice(-2)[0][0]}
                </div>
                <div className="flex-1">
                  <span className="text-[11px] font-semibold text-neutral-900">{result.speaker}</span>
                  <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100 mt-1.5">
                    <p className="text-[11px] font-normal text-neutral-700 leading-relaxed">
                      "{result.text.split(result.highlight).map((part, i, arr) => (
                        <React.Fragment key={i}>
                          {part}
                          {i < arr.length - 1 && <mark className="bg-yellow-200 px-0.5 rounded font-semibold">{result.highlight}</mark>}
                        </React.Fragment>
                      ))}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pl-10">
                <Btn icon={<Play size={12} />} label="Jump to Timestamp" />
                <Btn icon={<View size={12} />} label="Full Session Transcript" />
                <Btn icon={<DocumentExport size={12} />} label="Cite" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived sessions index */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mt-5">
        <div className="px-5 py-3 bg-neutral-50/50 border-b border-neutral-100 flex items-center gap-2">
          <Archive size={14} className="text-neutral-500" />
          <span className="text-[12px] font-semibold text-neutral-900">Session Archive Index</span>
        </div>
        <div className="grid grid-cols-[120px_1fr_80px_80px] gap-0 px-5 py-2.5 bg-neutral-50/30 border-b border-neutral-100">
          {["Session", "Date", "Measures", "Duration"].map(h => (
            <span key={h} className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>
        {archivedSessions.map(s => (
          <div key={s.session} className="grid grid-cols-[120px_1fr_80px_80px] gap-0 px-5 py-3 border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors items-center cursor-pointer">
            <span className="text-[12px] font-medium text-neutral-900">{s.session} Session</span>
            <span className="text-[11px] font-normal text-neutral-600">{s.date}</span>
            <span className="text-[11px] font-normal text-neutral-600">{s.measures} items</span>
            <span className="text-[11px] font-normal text-neutral-600">{s.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== EXPORTS ====================
