import { CornerUpLeft, MoreVertical, Send, Smile, X } from 'lucide-react';
import { FeatureDialog } from '../../../../../components/ui/FeatureDialog';
import { deleteMessage } from '../../../../../services/chatService';
import { parseMessage } from './messageCodec';
import { useTaskChat } from './useTaskChat';

export function TaskChatSection({ taskId, currentUserId, currentUserName }: { taskId: string; currentUserId?: string; currentUserName?: string }) {
  const { activeMoreMenuFor, activeReactionMenuFor, activeReactionTab, channelId, draft, handleSend, handleToggleReaction, messages, messagesEndRef, reactionsModalContent, replyingTo, sending, sendError, setSendError, setActiveMoreMenuFor, setActiveReactionMenuFor, setActiveReactionTab, setDraft, setReactionsModalContent, setReplyingTo } = useTaskChat(taskId, currentUserId, currentUserName);

if (!channelId) {
    return (
      <div className="pt-2 text-[11px] text-neutral-400 italic">
        Chat opens automatically once this task is assigned to someone.
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-neutral-100">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <label className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500">
          Task Chat
        </label>
      </div>
      <div className="max-h-[220px] min-h-[120px] overflow-y-auto space-y-3 mb-3 bg-[#f0f2f5] rounded-xl p-3 font-normal">
        {messages.map((m, idx) => {
          const mine = m.senderId === currentUserId;
          const parsed = parseMessage(m.content);
          const reactionsMap = parsed.reactions || {};
          const hasReactions = Object.values(reactionsMap).some((users) => users.length > 0);
          
          const myInitials = currentUserName?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";
          const senderInitials = m.senderName?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
          const isNearTop = idx < 2;

          const hoverActions = (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity duration-150 shrink-0 relative z-20">
              <div className="relative">
                <button
                  onClick={() => setActiveReactionMenuFor(activeReactionMenuFor === m.id ? null : m.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-neutral-50 text-neutral-500 transition-colors cursor-pointer"
                  title="React"
                >
                  <Smile size={12} />
                </button>
                {activeReactionMenuFor === m.id && (
                  <div className={`absolute ${isNearTop ? "top-8" : "bottom-8"} left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-neutral-200 rounded-full shadow-xl p-1.5 z-50`}>
                    {["👍", "❤️", "😂", "😮", "😢", "😡"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(m, emoji)}
                        className="text-[16px] hover:scale-130 transition-transform p-0.5 hover:drop-shadow cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setReplyingTo(m)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-neutral-50 text-neutral-500 transition-colors cursor-pointer"
                title="Reply"
              >
                <CornerUpLeft size={12} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setActiveMoreMenuFor(activeMoreMenuFor === m.id ? null : m.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-neutral-50 text-neutral-500 transition-colors cursor-pointer"
                  title="More"
                >
                  <MoreVertical size={12} />
                </button>
                {activeMoreMenuFor === m.id && (
                  <div className={`absolute z-50 ${isNearTop ? "top-8" : "bottom-8"} bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 w-28 ${mine ? "right-0" : "left-0"}`}>
                    <button
                      onClick={() => { deleteMessage(m.id); setActiveMoreMenuFor(null); }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                    {["Forward", "Pin", "Report"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { alert(`${opt}!`); setActiveMoreMenuFor(null); }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-neutral-700 hover:bg-neutral-50 font-normal"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <div key={m.id} className={`flex items-end gap-2 group ${mine ? "justify-end" : "justify-start"}`}>
              {/* Left Side elements */}
              {mine && hoverActions}
              {!mine && (
                <div className="w-7 h-7 rounded-full bg-neutral-300 text-neutral-700 text-[9px] flex items-center justify-center shrink-0 font-bold border-2 border-white shadow-sm">
                  {senderInitials}
                </div>
              )}

              {/* Bubble Container */}
              <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[72%] relative`}>
                {!mine && <span className="text-[9px] text-neutral-500 ml-2 mb-0.5 font-semibold">{m.senderName}</span>}
                
                {parsed.replyToText && (
                  <div className={`mb-1 text-[9px] text-neutral-500 bg-white/70 rounded-xl px-2.5 py-1.5 max-w-[90%] border-l-2 border-blue-400 shadow-xs ${mine ? "self-end" : "self-start"}`}>
                    <span className="font-bold text-blue-600 block">{parsed.replyToName}</span>
                    <span className="italic text-neutral-400 block truncate">{parsed.replyToText}</span>
                  </div>
                )}

                <div className="relative pb-1">
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed break-words ${
                      mine
                        ? "bg-blue-600 text-white rounded-br-sm shadow-sm"
                        : "bg-white text-neutral-800 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {parsed.text}
                  </div>
                  
                  {hasReactions && (
                    <button
                      onClick={() => {
                        const list: Array<{ name: string; emoji: string }> = [];
                        Object.entries(reactionsMap).forEach(([emoji, users]) => {
                          (users as string[]).forEach((username) => {
                            list.push({ name: username, emoji });
                          });
                        });
                        setReactionsModalContent({ all: list, byEmoji: reactionsMap });
                        setActiveReactionTab("all");
                      }}
                      className="absolute -bottom-2.5 right-2 flex items-center gap-0.5 bg-white border border-neutral-200 px-1.5 py-0.5 rounded-full shadow text-[10px] z-10 cursor-pointer hover:bg-neutral-50 active:scale-95 transition-all"
                    >
                      {Object.entries(reactionsMap).map(([emoji, users]) => {
                        if ((users as string[]).length === 0) return null;
                        return (
                          <span key={emoji} title={(users as string[]).join(", ")}>
                            {emoji}<span className="text-[8px] text-neutral-400 font-bold ml-0.5">{(users as string[]).length}</span>
                          </span>
                        );
                      })}
                    </button>
                  )}
                </div>
              </div>

              {/* Right Side elements */}
              {mine && (
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-[9px] flex items-center justify-center shrink-0 font-bold border-2 border-white shadow-sm">
                  {myInitials}
                </div>
              )}
              {!mine && hoverActions}
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <p className="text-[11px] text-neutral-400 italic text-center">No messages yet. Start the conversation!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyingTo && (
        <div className="px-3.5 py-1.5 bg-neutral-100 border rounded-lg mb-2 flex items-center justify-between text-[10px] text-neutral-500 font-normal">
          <span className="truncate">
            Replying to <span className="font-semibold">{replyingTo.senderName}</span>: "
            {parseMessage(replyingTo.content).text.slice(0, 40)}"
          </span>
          <button onClick={() => setReplyingTo(null)} className="text-neutral-400 hover:text-neutral-600">
            <X size={10} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          maxLength={1000}
          onChange={(e) => { setDraft(e.target.value); if (sendError) setSendError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message the team…"
          className="flex-1 h-[36px] rounded-full border border-neutral-200 bg-neutral-50 px-3.5 text-[12px] outline-none focus:border-neutral-300 focus:bg-white transition-all"
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95 disabled:bg-neutral-200 disabled:opacity-40"
        >
          <Send size={13} />
        </button>
      </div>
      <div className="mt-1 flex items-start justify-between gap-3 text-[10px]">
        <span role={sendError ? "alert" : undefined} className="text-rose-600">{sendError}</span>
        <span className={draft.length > 900 ? "shrink-0 text-rose-600" : "shrink-0 text-neutral-400"}>{draft.length}/1000</span>
      </div>
      
      {/* Detailed Reactions Modal */}
      {reactionsModalContent && (
        <FeatureDialog onClose={() => setReactionsModalContent(null)} title="Message reactions" contentClassName="!max-w-sm" showCloseButton={false}>
          <div className="flex max-h-[400px] w-full flex-col overflow-hidden rounded-[14px] border border-neutral-800 bg-[#242526] font-normal text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-[#242526]">
              <span className="text-[14px] font-bold">Message reactions</span>
              <button
                onClick={() => setReactionsModalContent(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-4 px-4 border-b border-neutral-800 bg-[#18191a] shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveReactionTab("all")}
                className={`py-2.5 px-1 text-[12px] font-semibold border-b-2 transition-all cursor-pointer ${
                  activeReactionTab === "all"
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                All {reactionsModalContent.all.length}
              </button>
              {Object.entries(reactionsModalContent.byEmoji).map(([emoji, users]) => {
                const count = (users as string[]).length;
                if (count === 0) return null;
                return (
                  <button
                    key={emoji}
                    onClick={() => setActiveReactionTab(emoji)}
                    className={`py-2.5 px-1 text-[12px] font-semibold border-b-2 transition-all flex items-center gap-1 cursor-pointer ${
                      activeReactionTab === emoji
                        ? "border-blue-500 text-blue-500"
                        : "border-transparent text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <span className="text-[14px]">{emoji}</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
            
            {/* User list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#242526]">
              {(activeReactionTab === "all"
                ? reactionsModalContent.all
                : reactionsModalContent.all.filter((item: any) => item.emoji === activeReactionTab)
              ).map((item: any, idx: number) => {
                const initials = item.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-750 text-neutral-200 text-[10px] font-bold flex items-center justify-center border border-neutral-700 shadow-xs">
                        {initials}
                      </div>
                      <div>
                        <div className="text-[12.5px] font-bold text-neutral-100">{item.name}</div>
                        <div className="text-[9px] text-neutral-400">Click to view profile</div>
                      </div>
                    </div>
                    <span className="text-[18px]">{item.emoji}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </FeatureDialog>
      )}
    </div>
  );
}

// ─── Task Subtasks Section ────────────────────────────────────────
