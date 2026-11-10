import { useEffect, useRef, useState } from 'react';
import { getChannelForTask, markChannelRead, sendMessageWithMentions, subscribeToChannelMessages, updateMessageContent, type ChatMessage } from '../../../../../services/chatService';
import { parseMessage } from './messageCodec';

export function useTaskChat(taskId: string, currentUserId?: string, currentUserName?: string) {
const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [activeReactionMenuFor, setActiveReactionMenuFor] = useState<string | null>(null);
  const [activeMoreMenuFor, setActiveMoreMenuFor] = useState<string | null>(null);
  const [reactionsModalContent, setReactionsModalContent] = useState<{
    all: Array<{ name: string; emoji: string }>;
    byEmoji: Record<string, string[]>;
  } | null>(null);
  const [activeReactionTab, setActiveReactionTab] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChannelForTask(taskId).then(setChannelId);
  }, [taskId]);

  useEffect(() => {if (!channelId) return;
    const unsub = subscribeToChannelMessages(channelId, setMessages);
    if (currentUserId) markChannelRead(channelId, currentUserId);
    return unsub;
  }, [channelId, currentUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!channelId || !draft.trim() || !currentUserId) return;
    setSending(true);
    setSendError("");
    try {
      let contentToSend = draft;
      if (replyingTo) {
        const payload = {
          text: draft,
          replyToId: replyingTo.id,
          replyToName: replyingTo.senderName,
          replyToText: parseMessage(replyingTo.content).text
        };
        contentToSend = JSON.stringify(payload);
      }
      await sendMessageWithMentions(channelId, currentUserId, currentUserName || "Someone", contentToSend);
      setDraft("");
      setReplyingTo(null);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (msg: ChatMessage, emoji: string) => {
    const parsed = parseMessage(msg.content);
    const reactions = parsed.reactions || {};
    const users = reactions[emoji] || [];
    const displayName = currentUserName || "Someone";
    
    console.log("[MondayBoard] Reacting to message:", msg.id, "with emoji:", emoji, "as user:", displayName);
    
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
    
    console.log("[MondayBoard] Calculated new reactions payload:", newReactions);
    
    // Optimistic UI Update: update state instantly
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, content: updatedContent } : m
      )
    );
    
    try {
      await updateMessageContent(msg.id, updatedContent);
      console.log("[MondayBoard] Reaction successfully saved to Supabase!");
    } catch (err) {
      console.error("[MondayBoard] Failed to save reaction to Supabase:", err);
      // Rollback on error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, content: msg.content } : m
        )
      );
    }
    
    setActiveReactionMenuFor(null);
  };

  return { activeMoreMenuFor, activeReactionMenuFor, activeReactionTab, channelId, draft, handleSend, handleToggleReaction, messages, messagesEndRef, reactionsModalContent, replyingTo, sending, sendError, setSendError, setActiveMoreMenuFor, setActiveReactionMenuFor, setActiveReactionTab, setDraft, setReactionsModalContent, setReplyingTo };
}
