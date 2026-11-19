import * as Carbon from "@carbon/icons-react";
import * as Lucide from "lucide-react";
import { useState } from "react";
import type { DocNote, TaskCard } from "./councilorData";
import { mockAISummary, mockFullText } from "./councilorData";

export function FocusReader({
  task,
  onBack,
  onAction,
}: {
  task: TaskCard;
  onBack: () => void;
  onAction: (action: string) => void;
}) {
  const [tab, setTab] = useState<"tldr" | "full">("tldr");
  const [notes, setNotes] = useState<DocNote[]>([
    { id: "n1", text: "Ask the Mayor about the specific contractor for this.", timestamp: "2:15 PM" },
  ]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNote, setNewNote] = useState("");

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes((prev) => [
      ...prev,
      {
        id: `n${Date.now()}`,
        text: newNote.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      },
    ]);
    setNewNote("");
    setShowNoteInput(false);
  };

  const isFloorVote = task.type === "Floor Vote";
  const isCommittee = task.type === "Committee Action";
  const headerLabel = isFloorVote ? "FLOOR VOTE" : isCommittee ? "COMMITTEE ACTION" : "READING MATERIAL";

  return (
    <div className="flex flex-col h-full">
      {/* Back Button + Header */}
      <div className="px-6 pt-5 pb-4 border-b border-neutral-100">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-normal text-neutral-500 cursor-pointer hover:text-neutral-700 transition-colors mb-4"
        >
          <Carbon.ChevronRight size={14} className="rotate-180" />
          Back to Inbox
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-normal px-2.5 py-1 rounded-full tracking-wider ${
            isFloorVote ? "bg-red-100 text-red-700" : isCommittee ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
          }`}>
            {headerLabel}
          </span>
          {task.timeInfo && (
            <span className="text-[11px] font-normal text-red-600 flex items-center gap-1">
              <Lucide.Clock size={10} />
              {task.timeInfo}
            </span>
          )}
        </div>
        <h1 className="text-[18px] font-normal text-neutral-900 mt-2">
          {task.title}
        </h1>
        <p className="text-[12px] font-normal text-neutral-500 mt-0.5">
          {task.subtitle}
        </p>
      </div>

      {/* Content Area - full width */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Tab Switcher */}
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-5 max-w-md">
          <button
            onClick={() => setTab("tldr")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] font-normal cursor-pointer transition-all duration-200 ${
              tab === "tldr"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            TL;DR — AI Summary
          </button>
          <button
            onClick={() => setTab("full")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] font-normal cursor-pointer transition-all duration-200 ${
              tab === "full"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Full Text
          </button>
        </div>

        {/* Document Content */}
        {tab === "tldr" ? (
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-6 rounded-lg bg-violet-100 flex items-center justify-center">
                <Lucide.Eye size={12} className="text-violet-600" />
              </div>
              <span className="text-[12px] font-normal text-violet-600">
                NLP Engine Summary
              </span>
            </div>
            {mockAISummary.map((point, i) => (
              <div key={i} className="flex gap-3 items-start p-4 bg-white rounded-xl border border-neutral-100">
                <span className="text-[14px] font-normal text-violet-500 mt-0.5 shrink-0">
                  {i + 1}.
                </span>
                <p className="text-[14px] font-normal text-neutral-700 leading-relaxed">
                  {point}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-100 p-6 mb-6">
            <pre className="whitespace-pre-wrap text-[13px] font-normal text-neutral-700 leading-relaxed">
              {mockFullText}
            </pre>
          </div>
        )}

        {/* Private Notes */}
        <div className="border-t border-neutral-100 pt-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lucide.EyeOff size={14} className="text-neutral-400" />
              <span className="text-[12px] font-normal text-neutral-500">
                Private Notes — Only visible to you
              </span>
            </div>
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-lg text-[12px] font-normal text-neutral-600 cursor-pointer hover:bg-neutral-200 transition-colors"
            >
              <Lucide.PenTool size={12} />
              Add Note
            </button>
          </div>
          {showNoteInput && (
            <div className="flex gap-2 mb-3">
              <input
                maxLength={1000}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder="Type your private note..."
                className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-[13px] font-normal text-neutral-700 outline-none focus:border-neutral-400 transition-colors"
              />
              <button
                onClick={addNote}
                className="px-3 py-2 bg-neutral-900 text-white rounded-lg text-[12px] font-normal cursor-pointer hover:bg-neutral-800 transition-colors"
              >
                Save
              </button>
            </div>
          )}
          {notes.length > 0 && (
            <div className="flex flex-col gap-2">
              {notes.map((note) => (
                <div key={note.id} className="flex items-start gap-2 p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                  <Lucide.StickyNote size={12} className="text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[13px] font-normal text-neutral-700">
                      {note.text}
                    </p>
                    <p className="text-[10px] font-normal text-neutral-400 mt-1">
                      {note.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - Sticky Bottom */}
      {task.priority !== "info" && (
        <div className="px-6 py-4 border-t border-neutral-100 bg-white">
          {isFloorVote ? (
            /* Floor Vote: Vote Yes / Vote No / Abstain */
            <div className="flex gap-3">
              <button
                onClick={() => onAction("vote_yes")}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[15px] font-normal cursor-pointer hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Lucide.ThumbsUp size={18} />
                Vote Yes
              </button>
              <button
                onClick={() => onAction("vote_no")}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[15px] font-normal cursor-pointer hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Lucide.ThumbsDown size={18} />
                Vote No
              </button>
              <button
                onClick={() => onAction("abstain")}
                className="py-4 px-6 bg-white text-neutral-600 border border-neutral-200 rounded-2xl text-[15px] font-normal cursor-pointer hover:bg-neutral-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Lucide.MinusCircle size={18} />
                Abstain
              </button>
            </div>
          ) : (
            /* Committee Action: Sign Favorable / Return for Revisions */
            <div className="flex gap-3">
              <button
                onClick={() => onAction("sign_favorable")}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[15px] font-normal cursor-pointer hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Carbon.CheckmarkOutline size={18} />
                Sign: Favorable
              </button>
              <button
                onClick={() => onAction("return_revisions")}
                className="flex-1 py-4 bg-white text-neutral-700 border border-neutral-200 rounded-2xl text-[15px] font-normal cursor-pointer hover:bg-neutral-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Carbon.Flag size={18} />
                Return for Revisions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== SIGNATURE / CONFIRMATION PAD ====================
