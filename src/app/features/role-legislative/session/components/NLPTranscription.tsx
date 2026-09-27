import { useRef, useState } from "react";
import { DocumentAdd, Download, Edit, Microphone, Send } from "@carbon/icons-react";
import { Btn, PageHeader, StatCard } from "./primitives";
import { liveTranscript, type TranscriptEntry } from "./sessionData";

export function NLPTranscription() {
  const [entries, setEntries] = useState(liveTranscript);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [officialNote, setOfficialNote] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleEdit = (id: number, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const saveEdit = (id: number) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, text: editText, editedBySecretariat: true } : e));
    setEditingId(null);
    setEditText("");
  };

  const insertOfficialNote = () => {
    if (!officialNote.trim()) return;
    const newEntry: TranscriptEntry = {
      id: entries.length + 1,
      speaker: "Sec. A. Mendoza",
      initials: "AM",
      role: "SP Secretary",
      text: officialNote,
      timestamp: "10:06:32",
      isOfficial: true,
    };
    setEntries(prev => [...prev, newEntry]);
    setOfficialNote("");
  };

  const roleColors: Record<string, string> = {
    "Presiding Officer": "bg-cyan-700",
    "SP Secretary": "bg-violet-700",
    Councilor: "bg-slate-700",
  };

  return (
    <div>
      <PageHeader
        title="Live Floor Transcript"
        subtitle="Session Management · NLP Transcription (AI Stenographer)"
        actions={<>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-lg">
            <Microphone size={14} className="text-white" />
            <span className="text-[11px] font-semibold text-white">RECORDING</span>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
          <Btn icon={<Download size={14} />} label="Export Transcript" />
        </>}
      />

      {/* Status bar */}
      <div className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 mb-5 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Microphone size={16} className="text-red-400" />
          <span className="text-[12px] font-semibold text-red-300">LIVE TRANSCRIPTION</span>
        </div>
        <div className="h-4 w-px bg-slate-600" />
        <span className="text-[11px] font-normal text-slate-300">Speech-to-Text: <strong className="text-emerald-300">Active</strong></span>
        <span className="text-[11px] font-normal text-slate-300">Speaker Diarization: <strong className="text-emerald-300">Online</strong></span>
        <span className="text-[11px] font-normal text-slate-300">Accuracy: <strong className="text-cyan-300">96.2%</strong></span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-normal text-slate-400">{entries.length} blocks captured</span>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Transcript Blocks" value={`${entries.length}`} sub="Auto-captured" />
        <StatCard label="Speakers Identified" value={`${[...new Set(entries.map(e => e.speaker))].length}`} sub="AI diarization" trend="up" />
        <StatCard label="Secretariat Edits" value={`${entries.filter(e => e.editedBySecretariat).length}`} sub="Manual corrections" />
        <StatCard label="Official Notes" value={`${entries.filter(e => e.isOfficial).length}`} sub="Inserted by secretary" />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Chat-style transcript feed */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex flex-col" style={{ maxHeight: 640 }}>
          <div className="px-5 py-3 bg-neutral-50/50 border-b border-neutral-100 flex items-center gap-2 shrink-0">
            <Microphone size={14} className="text-red-500" />
            <span className="text-[12px] font-semibold text-neutral-900">Live Transcript Feed</span>
            <span className="text-[10px] font-normal text-neutral-500">· 142nd Regular Session</span>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-medium text-red-500">LIVE</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {entries.map(entry => (
              <div key={entry.id} className={`flex gap-3 ${entry.isOfficial ? "bg-blue-50/50 -mx-2 px-2 py-2 rounded-lg border border-blue-100" : ""}`}>
                <div className={`w-8 h-8 rounded-full ${roleColors[entry.role] || "bg-slate-700"} flex items-center justify-center text-[9px] font-semibold text-white shrink-0 mt-0.5`}>
                  {entry.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-neutral-900">{entry.speaker}</span>
                    <span className="text-[9px] font-normal text-neutral-400">{entry.role}</span>
                    <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-neutral-400 ml-auto">{entry.timestamp}</span>
                    {entry.editedBySecretariat && (
                      <span className="text-[8px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">edited</span>
                    )}
                    {entry.isOfficial && (
                      <span className="text-[8px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">official note</span>
                    )}
                  </div>
                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full p-2 text-[12px] font-normal border border-blue-300 rounded-lg outline-none bg-blue-50/50 text-neutral-800 resize-none"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(entry.id)} className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground transition hover:bg-primary/90">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-lg text-[10px] font-semibold cursor-pointer hover:bg-neutral-200">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <p className="text-[12px] font-normal text-neutral-700 leading-relaxed">
                        "{entry.text}"
                      </p>
                      <button
                        onClick={() => handleEdit(entry.id, entry.text)}
                        className="absolute -right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white border border-neutral-200 shadow-sm cursor-pointer"
                        title="Edit for legal accuracy"
                      >
                        <Edit size={12} className="text-neutral-500" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            <div className="flex gap-3 items-center opacity-60">
              <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center shrink-0">
                <Microphone size={12} className="text-neutral-500" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-[10px] font-normal text-neutral-400 ml-1">Listening for speech…</span>
              </div>
            </div>
          </div>

          {/* Insert official note */}
          <div className="shrink-0 px-4 py-3 border-t border-neutral-200 bg-neutral-50/50">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                <DocumentAdd size={14} className="text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={officialNote}
                  onChange={(e) => setOfficialNote(e.target.value)}
                  placeholder="Insert official note…"
                  onKeyDown={(e) => e.key === "Enter" && insertOfficialNote()}
                  className="flex-1 bg-transparent outline-none text-[12px] font-normal text-neutral-800 placeholder:text-neutral-400"
                />
              </div>
              <button
                onClick={insertOfficialNote}
                className="rounded-lg bg-primary px-4 py-2.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel — Speaker stats & controls */}
        <div className="space-y-4">
          {/* Speaker diarization panel */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <h4 className="text-[12px] font-semibold text-neutral-900 mb-3">Speaker Diarization</h4>
            <div className="space-y-2.5">
              {[...new Set(entries.map(e => e.speaker))].map(speaker => {
                const speakerEntries = entries.filter(e => e.speaker === speaker);
                const entry = speakerEntries[0];
                const words = speakerEntries.reduce((sum, e) => sum + e.text.split(" ").length, 0);
                return (
                  <div key={speaker} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-neutral-50 transition-colors">
                    <div className={`w-7 h-7 rounded-full ${roleColors[entry.role] || "bg-slate-700"} flex items-center justify-center text-[8px] font-semibold text-white shrink-0`}>
                      {entry.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium text-neutral-900 block truncate">{speaker}</span>
                      <span className="text-[9px] font-normal text-neutral-400">{speakerEntries.length} blocks · ~{words} words</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session metadata */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <h4 className="text-[12px] font-semibold text-neutral-900 mb-3">Session Info</h4>
            <div className="space-y-2">
              {[
                ["Session", "142nd Regular Session"],
                ["Date", "April 16, 2026"],
                ["Presiding", "Vice Mayor F. Reyes"],
                ["Quorum", "12/12 present"],
                ["Duration", "1h 42m (ongoing)"],
                ["Mic Channels", "4 active"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-neutral-500">{k}</span>
                  <span className="text-[10px] font-normal text-neutral-800">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* NLP accuracy */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <h4 className="text-[12px] font-semibold text-neutral-900 mb-3">AI Model Performance</h4>
            <div className="space-y-3">
              {[
                { label: "Speech-to-Text Accuracy", value: 96.2, color: "bg-emerald-400" },
                { label: "Speaker ID Confidence", value: 92.8, color: "bg-blue-400" },
                { label: "Filipino/Bisaya Detection", value: 88.5, color: "bg-violet-400" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-normal text-neutral-600">{item.label}</span>
                    <span className="text-[10px] font-semibold text-neutral-900">{item.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
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

// ==================== SESSION SUMMARIES ====================
