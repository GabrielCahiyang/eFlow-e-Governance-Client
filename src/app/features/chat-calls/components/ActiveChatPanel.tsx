import { useState } from "react";
import * as Icons from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { deleteMessage } from "../../../services/chatService";
import { initiateCall } from "../../../services/callService";
import { useChatDrawer } from "./ChatDrawerContext";
import { parseMessage } from "../services/chatMessageCodec";
import { validateChatMessage } from "../services/chatModerationService";
import { motionTransition } from "../../../shared/motion/motionTokens";

export function ActiveChatPanel() {
  const [moderationError, setModerationError] = useState<string | null>(null);
  const {
    userId, userName, channels, activeChannelId, setActiveChannelId, messages,
    draft, setDraft, setOutgoingCall, replyingTo, setReplyingTo,
    activeReactionMenuFor, setActiveReactionMenuFor, activeMoreMenuFor,
    setActiveMoreMenuFor, setReactionsModalContent, setActiveReactionTab, messagesEndRef,
    startDrag, isFullscreen, setIsFullscreen, handleSend, handleToggleReaction,
  } = useChatDrawer();
  if (!activeChannelId) return null;
  return (
<div className="flex flex-col flex-1 min-h-0 bg-neutral-50/20">
              {/* Chat Drag Handle — centered pill bar like notifications */}
              <div
                onMouseDown={startDrag}
                className="h-5 flex items-center justify-center bg-white border-b border-neutral-100 cursor-grab active:cursor-grabbing shrink-0 select-none group"
                title="Drag to move"
              >
                <span className="w-8 h-0.5 rounded-full bg-neutral-400 opacity-30 group-hover:opacity-70 transition-opacity" />
              </div>
              <div className="px-3.5 py-3 border-b border-neutral-100 bg-white flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold flex items-center justify-center shrink-0 border border-blue-100">
                    {(
                      channels.find((c) => c.channelId === activeChannelId)
                        ?.name || "?"
                    )
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-neutral-800 truncate">
                      {
                        channels.find((c) => c.channelId === activeChannelId)
                          ?.name
                      }
                    </div>
                    <div className="text-[12px] text-neutral-500 font-normal flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Active now</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {channels.find((c) => c.channelId === activeChannelId)
                    ?.channelType === "direct" && (
                    <>
                      <button
                        onClick={async () => {
                          const ch = channels.find(
                            (c) => c.channelId === activeChannelId,
                          );
                          if (!ch || !userId) return;
                          const callId = await initiateCall(
                            activeChannelId,
                            userId,
                            userName || "Someone",
                            ch.otherUserId || "",
                            ch.otherUserName || "Unknown",
                            "audio",
                          );
                          setOutgoingCall({
                            id: callId,
                            channelId: activeChannelId,
                            callerId: userId,
                            callerName: userName || "Someone",
                            calleeId: ch.otherUserId || "",
                            calleeName: ch.otherUserName || "Unknown",
                            callType: "audio",
                            status: "ringing",
                          });
                        }}
                        aria-label="Start audio call"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition"
                      >
                        <Icons.Phone size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          const ch = channels.find(
                            (c) => c.channelId === activeChannelId,
                          );
                          if (!ch || !userId) return;
                          const callId = await initiateCall(
                            activeChannelId,
                            userId,
                            userName || "Someone",
                            ch.otherUserId || "",
                            ch.otherUserName || "Unknown",
                            "video",
                          );
                          setOutgoingCall({
                            id: callId,
                            channelId: activeChannelId,
                            callerId: userId,
                            callerName: userName || "Someone",
                            calleeId: ch.otherUserId || "",
                            calleeName: ch.otherUserName || "Unknown",
                            callType: "video",
                            status: "ringing",
                          });
                        }}
                        aria-label="Start video call"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition"
                      >
                        <Icons.Video size={13} />
                      </button>
                    </>
                  )}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setIsFullscreen((v) => !v)}
                    aria-label={isFullscreen ? "Exit full-screen chat" : "Expand chat"}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
                  >
                    {isFullscreen ? (
                      <Icons.Minimize2 size={13} />
                    ) : (
                      <Icons.Maximize2 size={13} />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveChannelId(null)}
                    aria-label="Back to conversations"
                    className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
                  >
                    <Icons.X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f0f2f5]">
                {messages.map((m, idx) => {
                  const mine = m.senderId === userId;
                  const parsed = parseMessage(m.content);
                  const reactionsMap = parsed.reactions || {};
                  const hasReactions = Object.values(reactionsMap).some(
                    (users) => users.length > 0,
                  );

                  const myInitials =
                    userName
                      ?.split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "ME";
                  const senderInitials =
                    m.senderName
                      ?.split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "?";
                  const isNearTop = idx < 2;

                  // Re-usable hover actions element
                  const hoverActions = (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity duration-150 shrink-0 relative z-20">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveReactionMenuFor(
                              activeReactionMenuFor === m.id ? null : m.id,
                            )
                          }
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-neutral-50 text-neutral-500 transition-colors cursor-pointer"
                          title="React"
                          aria-label="Add reaction"
                        >
                          <Icons.Smile size={12} />
                        </button>
                        {activeReactionMenuFor === m.id && (
                          <div
                            className={`absolute ${isNearTop ? "top-8" : "bottom-8"} left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-neutral-200 rounded-full shadow-xl p-1.5 z-50`}
                          >
                            {["👍", "❤️", "😂", "😮", "😢", "😡"].map(
                              (emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(m, emoji)}
                                  aria-label={`React with ${emoji}`}
                                  className="text-[16px] hover:scale-130 transition-transform p-0.5 hover:drop-shadow cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setReplyingTo(m)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-neutral-50 text-neutral-500 transition-colors cursor-pointer"
                        title="Reply"
                        aria-label="Reply to message"
                      >
                        <Icons.CornerUpLeft size={12} />
                      </button>

                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMoreMenuFor(
                              activeMoreMenuFor === m.id ? null : m.id,
                            )
                          }
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-neutral-50 text-neutral-500 transition-colors cursor-pointer"
                          title="More"
                          aria-label="More message actions"
                        >
                          <Icons.MoreVertical size={12} />
                        </button>
                        {activeMoreMenuFor === m.id && (
                          <div
                            className={`absolute z-50 ${isNearTop ? "top-8" : "bottom-8"} bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 w-28 ${mine ? "right-0" : "left-0"}`}
                          >
                            <button
                              onClick={() => {
                                deleteMessage(m.id);
                                setActiveMoreMenuFor(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 font-semibold cursor-pointer"
                            >
                              Remove
                            </button>
                            {["Forward", "Pin", "Report"].map((opt) => (
                              <button
                                key={opt}
                                onClick={() => {
                                  alert(`${opt}!`);
                                  setActiveMoreMenuFor(null);
                                }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-neutral-700 hover:bg-neutral-50 cursor-pointer"
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
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 group ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {/* Left Side elements */}
                      {mine && hoverActions}
                      {!mine && (
                        <div className="w-7 h-7 rounded-full bg-neutral-300 text-neutral-700 text-[9px] flex items-center justify-center shrink-0 font-bold border-2 border-white shadow-sm">
                          {senderInitials}
                        </div>
                      )}

                      {/* Bubble Container */}
                      <div
                        className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[72%] relative`}
                      >
                        {!mine && (
                          <span className="text-[12px] text-neutral-500 ml-2 mb-0.5 font-semibold">
                            {m.senderName}
                          </span>
                        )}

                        {parsed.replyToText && (
                          <div
                            className={`mb-1 text-[12px] text-neutral-600 bg-white/70 rounded-xl px-2.5 py-1.5 max-w-[90%] break-words border-l-2 border-blue-400 shadow-xs ${mine ? "self-end" : "self-start"}`}
                          >
                            <span className="font-bold text-blue-600 block">
                              {parsed.replyToName}
                            </span>
                            <span className="italic text-neutral-400 block truncate">
                              {parsed.replyToText}
                            </span>
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
                                const list: Array<{
                                  name: string;
                                  emoji: string;
                                }> = [];
                                Object.entries(reactionsMap).forEach(
                                  ([emoji, users]) => {
                                    (users as string[]).forEach((username) => {
                                      list.push({ name: username, emoji });
                                    });
                                  },
                                );
                                setReactionsModalContent({
                                  all: list,
                                  byEmoji: reactionsMap,
                                });
                                setActiveReactionTab("all");
                              }}
                              className="absolute -bottom-2.5 right-2 flex items-center gap-0.5 bg-white border border-neutral-200 px-1.5 py-0.5 rounded-full shadow text-[10px] z-10 cursor-pointer hover:bg-neutral-50 active:scale-95 transition-all"
                            >
                              {Object.entries(reactionsMap).map(
                                ([emoji, users]) => {
                                  if ((users as string[]).length === 0)
                                    return null;
                                  return (
                                    <span
                                      key={emoji}
                                      title={(users as string[]).join(", ")}
                                    >
                                      {emoji}
                                      <span className="text-[8px] text-neutral-400 font-bold ml-0.5">
                                        {(users as string[]).length}
                                      </span>
                                    </span>
                                  );
                                },
                              )}
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
                  <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Icons.MessageCircle size={18} className="text-blue-400" />
                    </div>
                    <p className="text-[12px] text-neutral-500 text-center">
                      No messages yet.
                      <br />
                      Say hello! 👋
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {replyingTo && (
                <div className="px-3.5 py-1.5 bg-neutral-100 border-t border-neutral-200 flex items-center justify-between text-[12px] text-neutral-500 shrink-0 font-normal">
                  <span className="truncate">
                    Replying to{" "}
                    <span className="font-semibold">
                      {replyingTo.senderName}
                    </span>
                    : "{parseMessage(replyingTo.content).text.slice(0, 40)}"
                  </span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <Icons.X size={10} />
                  </button>
                </div>
              )}

              <AnimatePresence>
                {moderationError && (
                  <m.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={motionTransition.productive}
                    className="px-3.5 py-2 bg-rose-50 border-t border-rose-200 text-rose-800 text-[11px] flex items-center justify-between gap-2 shrink-0 font-medium"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Icons.AlertTriangle size={13} className="text-rose-600 shrink-0" />
                      <span className="truncate">{moderationError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModerationError(null)}
                      className="text-rose-500 hover:text-rose-700 p-0.5 rounded shrink-0"
                    >
                      <Icons.X size={12} />
                    </button>
                  </m.div>
                )}
              </AnimatePresence>

              <div className="p-3 border-t border-neutral-100 bg-white flex items-center gap-2 shrink-0">
                <div className="relative flex-1 flex items-center">
                  <input
                    value={draft}
                    maxLength={1000}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (moderationError) setModerationError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!draft.trim()) return;
                        const check = validateChatMessage(draft);
                        if (!check.isValid) {
                          setModerationError(check.reason || "Message violates workplace communication standards.");
                          return;
                        }
                        setModerationError(null);
                        handleSend();
                      }
                    }}
                    placeholder="Message… (max 1,000 characters)"
                    className="w-full h-[36px] rounded-full border border-neutral-200 bg-neutral-50 pl-4 pr-16 text-[12px] outline-none focus:border-neutral-300 focus:bg-white transition-all"
                  />
                  {draft.length > 0 && (
                    <span
                      className={`absolute right-3 text-[10px] tabular-nums font-medium pointer-events-none select-none ${
                        draft.length > 900 ? "text-rose-500 font-semibold" : "text-neutral-400"
                      }`}
                    >
                      {draft.length}/1000
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!draft.trim()) return;
                    const check = validateChatMessage(draft);
                    if (!check.isValid) {
                      setModerationError(check.reason || "Message violates workplace communication standards.");
                      return;
                    }
                    setModerationError(null);
                    handleSend();
                  }}
                  disabled={!draft.trim()}
                  className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 disabled:bg-neutral-200 hover:bg-blue-700 active:scale-95 transition-all shrink-0 shadow-sm"
                >
                  <Icons.Send size={13} />
                </button>
              </div>
            </div>
  );
}
