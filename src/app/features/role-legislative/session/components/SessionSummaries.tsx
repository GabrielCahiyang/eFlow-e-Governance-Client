import { useState } from "react";
import { Analytics, CheckmarkOutline, Download, Flag, Share, Time } from "@carbon/icons-react";
import { Btn, PageHeader, Pill, StatCard } from "./primitives";
import { sessionSummaries } from "./sessionData";

export function SessionSummaries() {
  const [selectedSummary, setSelectedSummary] = useState(sessionSummaries[0]);

  return (
    <div>
      <PageHeader
        title="AI Generated Summaries"
        subtitle="Session Management · Minutes & Transcripts"
        actions={<>
          <Btn icon={<Share size={14} />} label="Publish to Transparency Portal" variant="primary" />
          <Btn icon={<Download size={14} />} label="Export PDF" />
        </>}
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Sessions Summarized" value={`${sessionSummaries.length}`} sub="AI-generated briefs" />
        <StatCard label="Avg. Compression" value="96%" sub="50 pages → 2 pages" trend="up" />
        <StatCard label="Published" value={`${sessionSummaries.filter(s => s.status === "Finalized").length}`} sub="On transparency portal" />
        <StatCard label="Latest" value="142nd" sub="AI processing complete" />
      </div>

      {/* Session selector */}
      <div className="flex gap-3 mb-5">
        {sessionSummaries.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSummary(s)}
            className={`px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer transition-all ${
              selectedSummary.id === s.id
                ? "bg-primary text-primary-foreground"
                : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {s.session} · {s.date}
          </button>
        ))}
      </div>

      {/* Summary content */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 bg-neutral-50/50 border-b border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-neutral-900">{selectedSummary.session}</h3>
              <p className="text-[11px] font-normal text-neutral-500 mt-0.5">
                {selectedSummary.date} · Duration: {selectedSummary.duration} · Attendance: {selectedSummary.attendees}/{selectedSummary.totalAttendees}
              </p>
            </div>
            <Pill status={selectedSummary.status} />
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* NLP compression indicator */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-start gap-3">
              <Analytics size={16} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] font-semibold text-blue-800">NLP Auto-Summary</span>
                <p className="text-[10px] font-normal text-blue-700 mt-0.5">
                  This {selectedSummary.duration} session produced ~{parseInt(selectedSummary.duration) * 12} pages of raw transcript.
                  The NLP engine compressed it into this concise executive brief immediately after <strong>[End Session]</strong> was pressed.
                </p>
              </div>
            </div>
          </div>

          {/* Motions Passed */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckmarkOutline size={14} className="text-emerald-600" />
              </div>
              <h4 className="text-[14px] font-semibold text-neutral-900">Motions Passed</h4>
              <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">{selectedSummary.motionsPassed.length}</span>
            </div>
            <div className="space-y-2 pl-8">
              {selectedSummary.motionsPassed.map((motion, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span className="text-[12px] font-normal text-neutral-700 leading-relaxed">{motion}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Measures Deferred */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                <Time size={14} className="text-amber-600" />
              </div>
              <h4 className="text-[14px] font-semibold text-neutral-900">Measures Deferred</h4>
              <span className="text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{selectedSummary.measuresDeferred.length}</span>
            </div>
            <div className="space-y-2 pl-8">
              {selectedSummary.measuresDeferred.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <span className="text-[12px] font-normal text-neutral-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Debates & Dissenting Opinions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
                <Flag size={14} className="text-orange-600" />
              </div>
              <h4 className="text-[14px] font-semibold text-neutral-900">Key Debates & Dissenting Opinions</h4>
            </div>
            <div className="space-y-3 pl-8">
              {selectedSummary.keyDebates.map((debate, i) => (
                <div key={i} className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
                  <h5 className="text-[12px] font-semibold text-neutral-900 mb-1.5">{debate.topic}</h5>
                  <p className="text-[11px] font-normal text-neutral-700 leading-relaxed mb-2">{debate.summary}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-medium text-neutral-500">Dissenting:</span>
                    <span className="text-[10px] font-normal text-red-600">{debate.dissenting}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ARCHIVED MINUTES ====================
