  import { supabase } from "../../lib/supabase";
  import { controlPanelFetch } from "../shared/controlPanelClient";
  import { validateOutgoingChatContent } from "../features/chat-calls/services/chatModerationService";

  function validateOutgoingContent(content: string): void {
    const result = validateOutgoingChatContent(content);
    if (!result.isValid) throw new Error(result.reason || "Message violates workplace communication standards.");
  }

  export interface ChatMessage {
    id: string;
    channelId: string;
    senderId: string;
    senderName: string;
    content: string;
    createdAt: number;
  }

  export interface ChatChannelSummary {
    channelId: string;
    channelType?: string;
    taskId?: string;
    orgId?: string;
    name: string;
    lastMessage?: string;
    lastMessageAt?: number;
    unread: boolean;
    isLeadOf?: boolean;
    otherUserId?: string;
    otherUserName?: string;
  }

  function rowToMessage(row: Record<string, unknown>): ChatMessage {
    return {
      id: row.id as string,
      channelId: row.channel_id as string,
      senderId: (row.sender_id as string) || "",
      senderName: (row.sender_name as string) || "",
      content: row.content as string,
      createdAt: new Date(row.created_at as string).getTime(),
    };
  }

  // ─── getChannelForTask ──────────────────────────────────────────────
  // A task conversation is only visible to its current chat members.
  export async function getChannelForTask(taskId: string): Promise<string | null> {
    const { data } = await supabase
      .from("chat_channels")
      .select("id")
      .eq("task_id", taskId)
      .maybeSingle();
    return data?.id || null;
  }

  // ─── subscribeToChannelMessages ─────────────────────────────────────
  export function subscribeToChannelMessages(
    channelId: string,
    callback: (messages: ChatMessage[]) => void,
  ): () => void {
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });
      if (data) callback(data.map(rowToMessage));
    };
    load();

    const channelIdUnique = `chat-${channelId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelIdUnique)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

// ─── sendMessageWithMentions ─────────────────────────────────────────
export async function sendMessageWithMentions(
  channelId: string,
  senderId: string,
  senderName: string,
  content: string,
  imagePath?: string,
): Promise<void> {
  await sendMessage(channelId, senderId, senderName, content, imagePath);

  const mentionPattern = /@(\w+)/g;
  const mentioned = [...content.matchAll(mentionPattern)].map((m) => m[1]);
  if (mentioned.length === 0) return;

  const { data: members } = await supabase
    .from("chat_channel_members")
    .select("user_id, profiles(full_name)")
    .eq("channel_id", channelId);

  for (const name of mentioned) {
    const match = (members || []).find((m: any) =>
      m.profiles?.full_name?.toLowerCase().startsWith(name.toLowerCase()),
    );
    if (match && match.user_id !== senderId) {
      const { createNotification } = await import("./notificationService");
      await createNotification(match.user_id, {
        type: "comment",
        title: "You were mentioned",
        message: `${senderName} mentioned you: "${content.slice(0, 80)}"`,
      }).catch(() => { /* The message was already saved. */ });
    }
  }
}
  // ─── sendMessage ─────────────────────────────────────────────────────
  export async function sendMessage(
    channelId: string,
    senderId: string,
    senderName: string,
    content: string,
    imagePath?: string,
  ): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed && !imagePath) return;
    if (trimmed) validateOutgoingContent(trimmed);
    const { error } = await supabase.from("chat_messages").insert({
      channel_id: channelId,
      sender_id: senderId,
      sender_name: senderName,
      content: trimmed,
      ...(imagePath ? { image_path: imagePath } : {}),
    });
    if (error) throw error;
  }

  // ─── markChannelRead ─────────────────────────────────────────────────
  export async function markChannelRead(channelId: string, userId: string): Promise<void> {
    await supabase
      .from("chat_channel_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channelId)
      .eq("user_id", userId);
  }

  // ─── deleteMessage ───────────────────────────────────────────────────
  export async function deleteMessage(messageId: string): Promise<void> {
    const res = await controlPanelFetch("admin/chat/messages/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("FastAPI delete message error:", errText);
      throw new Error(`Failed to delete message: ${errText}`);
    }
  }

  // ─── updateMessageContent ────────────────────────────────────────────
  export async function updateMessageContent(messageId: string, newContent: string): Promise<void> {
    validateOutgoingContent(newContent);
    const res = await controlPanelFetch("admin/chat/messages/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, newContent }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("FastAPI update message content error:", errText);
      throw new Error(`Failed to update message: ${errText}`);
    }
  }

  // ─── subscribeToMyChannels ───────────────────────────────────────────
  // Powers the global chat icon's channel list. Unread = any message in
  // the channel newer than this user's last_read_at for that channel.
  // ─── getOrCreateDirectChannel ────────────────────────────────────────
// Direct channels aren't keyed by task_id or org_id like the other two
// types — they're keyed by the pair of members. Look up via
// chat_channel_members (the same table task channels already use for
// membership) rather than inventing a second membership mechanism.
export async function getOrCreateDirectChannel(
  userIdA: string,
  userIdB: string,
): Promise<string> {
  const { data: myDirectChannels } = await supabase
    .from("chat_channel_members")
    .select("channel_id, chat_channels!inner(channel_type)")
    .eq("user_id", userIdA)
    .eq("chat_channels.channel_type", "direct");

  const candidateIds = (myDirectChannels || []).map((row: any) => row.channel_id);

  if (candidateIds.length > 0) {
    const { data: shared } = await supabase
      .from("chat_channel_members")
      .select("channel_id")
      .eq("user_id", userIdB)
      .in("channel_id", candidateIds)
      .maybeSingle();

    if (shared?.channel_id) return shared.channel_id;
  }

  const { data: newChannel, error } = await supabase
    .from("chat_channels")
    .insert({ channel_type: "direct", name: "" })
    .select()
    .single();
  if (error) throw error;

  await supabase.from("chat_channel_members").insert([
    { channel_id: newChannel.id, user_id: userIdA },
    { channel_id: newChannel.id, user_id: userIdB },
  ]);

  return newChannel.id;
}

export function subscribeToMyChannels(
    userId: string,
    ancestorOrgIds: string[],
    callback: (channels: ChatChannelSummary[]) => void,
  ): () => void {
    const load = async () => {
      // Task channels — membership-based, filter to only task channels
      const { data: memberships } = await supabase
        .from("chat_channel_members")
        .select("channel_id, last_read_at, chat_channels(id, name, task_id, channel_type)")
        .eq("user_id", userId);

      const taskSummaries: ChatChannelSummary[] = await Promise.all(
        (memberships || [])
          .filter((m: any) => m.chat_channels?.task_id)
          .map(async (m: any) => {
            const { data: lastMsg } = await supabase
              .from("chat_messages")
              .select("content, created_at")
              .eq("channel_id", m.channel_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            const { data: task } = await supabase
              .from("tasks")
              .select("assigned_to")
              .eq("id", m.chat_channels?.task_id)
              .maybeSingle();
            
            return {
              channelId: m.channel_id,
              channelType: m.chat_channels?.channel_type,
              taskId: m.chat_channels?.task_id || undefined,
              name: m.chat_channels?.name || "Untitled",
              lastMessage: lastMsg?.content,
              lastMessageAt: lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : undefined,
              unread: lastMsg?.created_at
                ? new Date(lastMsg.created_at) > new Date(m.last_read_at)
                : false,
              isLeadOf: task?.assigned_to === userId,
            };
          }),
      );

      // Direct channels — membership-based, filter to direct type
      const directSummaries: ChatChannelSummary[] = await Promise.all(
        (memberships || [])
          .filter((m: any) => m.chat_channels?.channel_type === "direct")
          .map(async (m: any) => {
            // Find the other member in this direct channel
            const { data: otherMember } = await supabase
              .from("chat_channel_members")
              .select("user_id, profiles(full_name)")
              .eq("channel_id", m.channel_id)
              .neq("user_id", userId)
              .maybeSingle();

            const { data: lastMsg } = await supabase
              .from("chat_messages")
              .select("content, created_at")
              .eq("channel_id", m.channel_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const otherName = (otherMember?.profiles as any)?.full_name || "Unknown";
            return {
              channelId: m.channel_id,
              channelType: "direct",
              name: otherName,
              lastMessage: lastMsg?.content,
              lastMessageAt: lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : undefined,
              unread: lastMsg?.created_at
                ? new Date(lastMsg.created_at) > new Date(m.last_read_at)
                : false,
              otherUserId: otherMember?.user_id,
              otherUserName: otherName,
            };
          }),
      );

      // Org (standing) channels — NEW. No membership table to query;
      // resolve directly from the ancestor org ids the caller computed.
      let orgSummaries: ChatChannelSummary[] = [];
      if (ancestorOrgIds.length > 0) {
        const { data: orgChannels } = await supabase
          .from("chat_channels")
          .select("id, name, org_id")
          .eq("channel_type", "org")
          .in("org_id", ancestorOrgIds);

        orgSummaries = await Promise.all(
          (orgChannels || []).map(async (ch) => {
            const { data: lastMsg } = await supabase
              .from("chat_messages")
              .select("content, created_at")
              .eq("channel_id", ch.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            return {
              channelId: ch.id,
              channelType: "org",
              orgId: ch.org_id,
              name: ch.name,
              lastMessage: lastMsg?.content,
              lastMessageAt: lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : undefined,
              unread: false, // no per-user read tracking for standing channels
              isLeadOf: false,
            };
          }),
        );
      }

      const all = [...directSummaries, ...orgSummaries, ...taskSummaries];
      all.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      callback(all);
    };
    load();

    const channelIdUnique = `my-channels-${userId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelIdUnique)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
