import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  type ChatChannelSummary,
  type ChatMessage,
  markChannelRead,
  sendMessageWithMentions,
  subscribeToChannelMessages,
  subscribeToMyChannels,
  updateMessageContent,
} from "../../../services/chatService";
import type { ActiveCall } from "../../../services/callService";
import { useOrgs } from "../../../hooks/useSupabaseData";
import { getAncestorOrgIds } from "../../../../lib/supabaseService";
import { parseMessage } from "../services/chatMessageCodec";
import { clampChatPanelPosition, clampChatPanelSize } from "../services/chatPanelLayout";

export interface ChatDrawerUser {
  userId?: string;
  userName?: string;
  userOrgId?: string;
}

export function useChatDrawerController({ userId, userName, userOrgId }: ChatDrawerUser) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<ChatChannelSummary[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [outgoingCall, setOutgoingCall] = useState<ActiveCall | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [activeReactionMenuFor, setActiveReactionMenuFor] = useState<
    string | null
  >(null);
  const [activeMoreMenuFor, setActiveMoreMenuFor] = useState<string | null>(
    null,
  );
  const [reactionsModalContent, setReactionsModalContent] = useState<{
    all: Array<{ name: string; emoji: string }>;
    byEmoji: Record<string, string[]>;
  } | null>(null);
  const [activeReactionTab, setActiveReactionTab] = useState<string>("all");

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Free-form panel position/size ────────────────────────────────────
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [panelSize, setPanelSize] = useState<{ w: number; h: number }>({
    w: 320,
    h: 420,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeState = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const startDrag = useCallback(
    (e: ReactMouseEvent) => {
      if (isFullscreen) return;
      e.preventDefault();
      const pos = panelPos ?? { x: 80, y: 80 };
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
      const onMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        setPanelPos(clampChatPanelPosition({
          x: dragState.current.origX + dx,
          y: dragState.current.origY + dy,
        }, panelSize, { width: window.innerWidth, height: window.innerHeight }));
      };
      const onUp = () => {
        dragState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isFullscreen, panelPos, panelSize],
  );

  const startResize = useCallback(
    (e: ReactMouseEvent) => {
      if (isFullscreen) return;
      e.preventDefault();
      e.stopPropagation();
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: panelSize.w,
        origH: panelSize.h,
      };
      const onMove = (ev: MouseEvent) => {
        if (!resizeState.current) return;
        const dw = ev.clientX - resizeState.current.startX;
        const dh = ev.clientY - resizeState.current.startY;
        const nextSize = clampChatPanelSize({
          w: resizeState.current.origW + dw,
          h: resizeState.current.origH + dh,
        }, { width: window.innerWidth, height: window.innerHeight });
        setPanelSize(nextSize);
        setPanelPos((position) => position ? clampChatPanelPosition(position, nextSize, { width: window.innerWidth, height: window.innerHeight }) : position);
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isFullscreen, panelSize],
  );

  const { orgs } = useOrgs();
  const ancestorOrgIds = useMemo(
    () => getAncestorOrgIds(orgs, userOrgId),
    [orgs, userOrgId],
  );

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToMyChannels(userId, ancestorOrgIds, setChannels);
    return unsub;
  }, [userId, ancestorOrgIds]);

  useEffect(() => {
    if (!activeChannelId) return;
    const unsub = subscribeToChannelMessages(activeChannelId, setMessages);
    if (userId) markChannelRead(activeChannelId, userId);
    return unsub;
  }, [activeChannelId, userId]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Seed initial panel position from button location on first open
  useEffect(() => {
    if (!open || panelPos !== null || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = rect.right > 0 ? rect.right + 12 : 80;
    const top = Math.max(8, rect.top - 350);
    setPanelPos(clampChatPanelPosition({ x: left, y: top }, panelSize, { width: window.innerWidth, height: window.innerHeight }));
  }, [open, panelPos, panelSize]);

  // Reset position when panel is closed
  useEffect(() => {
    if (!open) {
      setPanelPos(null);
      setIsFullscreen(false);
    }
  }, [open]);

  useEffect(() => {
    const keepPanelVisible = () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setPanelSize((size) => {
        const nextSize = clampChatPanelSize(size, viewport);
        setPanelPos((position) => position ? clampChatPanelPosition(position, nextSize, viewport) : position);
        return nextSize;
      });
    };
    window.addEventListener("resize", keepPanelVisible);
    return () => window.removeEventListener("resize", keepPanelVisible);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadTotal = channels.filter((c) => c.unread).length;

  const handleSend = async () => {
    if (!activeChannelId || !draft.trim() || !userId) return;

    let contentToSend = draft;
    if (replyingTo) {
      const payload = {
        text: draft,
        replyToName: replyingTo.senderName,
        replyToText: parseMessage(replyingTo.content).text,
      };
      contentToSend = JSON.stringify(payload);
    }

    await sendMessageWithMentions(
      activeChannelId,
      userId,
      userName || "Someone",
      contentToSend,
    );
    setDraft("");
    setReplyingTo(null);
  };

  const handleToggleReaction = async (msg: ChatMessage, emoji: string) => {
    const parsed = parseMessage(msg.content);
    const reactions = parsed.reactions || {};
    const users = reactions[emoji] || [];
    const displayName = userName || "Someone";

    console.log(
      "[ChatListDrawer] Reacting to message:",
      msg.id,
      "with emoji:",
      emoji,
      "as user:",
      displayName,
    );

    let newUsers: string[];
    if (users.includes(displayName)) {
      newUsers = users.filter((u) => u !== displayName);
    } else {
      newUsers = [...users, displayName];
    }

    const newReactions = { ...reactions, [emoji]: newUsers };
    const updatedContent = JSON.stringify({
      ...parsed,
      reactions: newReactions,
    });

    console.log(
      "[ChatListDrawer] Calculated new reactions payload:",
      newReactions,
    );

    // Optimistic UI Update: update state instantly
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, content: updatedContent } : m,
      ),
    );

    try {
      await updateMessageContent(msg.id, updatedContent);
      console.log("[ChatListDrawer] Reaction successfully saved to Supabase!");
    } catch (err) {
      console.error(
        "[ChatListDrawer] Failed to save reaction to Supabase:",
        err,
      );
      // Rollback on error
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, content: msg.content } : m)),
      );
    }

    setActiveReactionMenuFor(null);
  };


  return {
    userId,
    userName,
    open,
    setOpen,
    channels,
    activeChannelId,
    setActiveChannelId,
    messages,
    setMessages,
    draft,
    setDraft,
    outgoingCall,
    setOutgoingCall,
    replyingTo,
    setReplyingTo,
    activeReactionMenuFor,
    setActiveReactionMenuFor,
    activeMoreMenuFor,
    setActiveMoreMenuFor,
    reactionsModalContent,
    setReactionsModalContent,
    activeReactionTab,
    setActiveReactionTab,
    buttonRef,
    panelRef,
    messagesEndRef,
    panelPos,
    panelSize,
    isFullscreen,
    setIsFullscreen,
    startDrag,
    startResize,
    unreadTotal,
    handleSend,
    handleToggleReaction,
  };
}
