import * as Icons from "lucide-react";
import { useChatDrawer } from "./ChatDrawerContext";
import { parseMessage } from "../services/chatMessageCodec";
import { ChatUnreadBadge } from "./ChatUnreadBadge";

export function ChatChannelList() {
  const { channels, activeChannelId, setActiveChannelId, startDrag, isFullscreen, setIsFullscreen } = useChatDrawer();
  return (
<div className="flex flex-col flex-1 overflow-hidden">
              {/* Drag Handle — centered pill bar like notifications */}
              <div
                onMouseDown={startDrag}
                className="h-5 flex items-center justify-center bg-white border-b border-neutral-100 cursor-grab active:cursor-grabbing shrink-0 select-none group"
                title="Drag to move"
              >
                <span className="w-8 h-0.5 rounded-full bg-neutral-400 opacity-30 group-hover:opacity-70 transition-opacity" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 bg-white shrink-0">
                <span className="text-[14px] font-semibold text-neutral-800">Chats</span>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setIsFullscreen((v) => !v)}
                  aria-label={isFullscreen ? "Exit full-screen chats" : "Expand chats"}
                  className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition"
                >
                  {isFullscreen ? <Icons.Minimize2 size={11} /> : <Icons.Maximize2 size={11} />}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {channels.filter((c) => c.channelType === "direct").length >
                  0 && (
                  <div className="px-3 py-1.5 text-[12px] uppercase tracking-wider text-neutral-500 bg-neutral-50">
                    Direct Messages
                  </div>
                )}
                {channels
                  .filter((c) => c.channelType === "direct")
                  .map((c) => (
                    <button
                      key={c.channelId}
                      onClick={() => setActiveChannelId(c.channelId)}
                      aria-label={`${c.name}${c.unread ? ", unread" : ""}`}
                      aria-current={activeChannelId === c.channelId ? "page" : undefined}
                      className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 border-b border-neutral-50 flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] text-neutral-800 truncate font-medium">
                          {c.name}
                        </div>
                        <div className="text-[12px] text-neutral-500 truncate">
                          {c.lastMessage
                            ? parseMessage(c.lastMessage).text
                            : "No messages yet"}
                        </div>
                      </div>
                      {c.unread && (
                        <ChatUnreadBadge />
                      )}
                    </button>
                  ))}
                {channels.filter((c) => c.isLeadOf).length > 0 && (
                  <div className="px-3 py-1.5 text-[12px] uppercase tracking-wider text-amber-700 bg-amber-50 border-l-2 border-amber-500 flex items-center gap-1">
                    <Icons.Star size={10} className="fill-amber-500 text-amber-500" />
                    Pinned — You're Leading
                  </div>
                )}
                {channels
                  .filter((c) => c.isLeadOf)
                  .map((c) => (
                    <button
                      key={c.channelId}
                      onClick={() => setActiveChannelId(c.channelId)}
                      aria-label={`${c.name}${c.unread ? ", unread" : ""}`}
                      aria-current={activeChannelId === c.channelId ? "page" : undefined}
                      className="w-full text-left px-3 py-2.5 hover:bg-amber-50/50 border-b border-amber-100/50 flex items-center justify-between bg-amber-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-neutral-800 truncate font-medium flex items-center gap-1.5">
                          <Icons.Star
                            size={10}
                            className="fill-amber-400 text-amber-400 shrink-0"
                          />
                          {c.name}
                        </div>
                        <div className="text-[12px] text-neutral-500 truncate">
                          {c.lastMessage
                            ? parseMessage(c.lastMessage).text
                            : "No messages yet"}
                        </div>
                      </div>
                      {c.unread && (
                        <ChatUnreadBadge />
                      )}
                    </button>
                  ))}
                {channels.filter((c) => c.orgId).length > 0 && (
                  <div className="px-3 py-1.5 text-[12px] uppercase tracking-wider text-neutral-500 bg-neutral-50">
                    Standing Channels
                  </div>
                )}
                {channels
                  .filter((c) => c.orgId)
                  .map((c) => (
                    <button
                      key={c.channelId}
                      onClick={() => setActiveChannelId(c.channelId)}
                      aria-label={`${c.name}${c.unread ? ", unread" : ""}`}
                      aria-current={activeChannelId === c.channelId ? "page" : undefined}
                      className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 border-b border-neutral-50 flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] text-neutral-800 truncate font-medium">
                          {c.name}
                        </div>
                        <div className="text-[12px] text-neutral-500 truncate">
                          {c.lastMessage
                            ? parseMessage(c.lastMessage).text
                            : "No messages yet"}
                        </div>
                      </div>
                      {c.unread && (
                        <ChatUnreadBadge />
                      )}
                    </button>
                  ))}
                {channels.filter((c) => c.taskId && !c.isLeadOf).length > 0 && (
                  <div className="px-3 py-1.5 text-[12px] uppercase tracking-wider text-neutral-500 bg-neutral-50">
                    Task Chats
                  </div>
                )}
                {channels
                  .filter((c) => c.taskId && !c.isLeadOf)
                  .map((c) => (
                    <button
                      key={c.channelId}
                      onClick={() => setActiveChannelId(c.channelId)}
                      aria-label={`${c.name}${c.unread ? ", unread" : ""}`}
                      aria-current={activeChannelId === c.channelId ? "page" : undefined}
                      className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 border-b border-neutral-50 flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] text-neutral-800 truncate font-medium">
                          {c.name}
                        </div>
                        <div className="text-[12px] text-neutral-500 truncate">
                          {c.lastMessage
                            ? parseMessage(c.lastMessage).text
                            : "No messages yet"}
                        </div>
                      </div>
                      {c.unread && (
                        <ChatUnreadBadge />
                      )}
                    </button>
                  ))}
                {channels.length === 0 && (
                  <div className="px-3 py-6 text-center text-[12px] text-neutral-500">
                    No chats yet.
                  </div>
                )}
              </div>
            </div>
  );
}
