import { supabase } from '../../../../lib/supabase';
import type { ChatChannelSummary, ChatMessage } from '../../../services/chatService';

export type Conversation = ChatChannelSummary & { projectTitle?: string; projectId?: string };
export type Message = ChatMessage & { sentAt: string; pinned: boolean; imagePath?: string; reactions: Record<string, string[]> };
export type ChatPerson = { id: string; name: string | null; is_lead: boolean };
type ConversationRow = {
  channel_id: string; channel_type: string; task_id?: string; org_id?: string; project_id?: string;
  name: string; project_title?: string; last_message?: string; last_message_at?: string;
  unread: boolean; is_lead: boolean; other_user_id?: string;
};

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('list_message_conversations');
  if (error) throw error;
  return ((data || []) as ConversationRow[]).map(row => ({
    channelId: row.channel_id, channelType: row.channel_type, taskId: row.task_id,
    orgId: row.org_id, projectId: row.project_id, name: row.name, projectTitle: row.project_title,
    lastMessage: row.last_message, lastMessageAt: row.last_message_at ? Date.parse(row.last_message_at) : undefined,
    unread: row.unread, isLeadOf: row.is_lead, otherUserId: row.other_user_id, otherUserName: row.name,
  }));
}

export async function listMessages(channelId: string, before?: Message): Promise<Message[]> {
  let query = supabase.from('chat_messages')
    .select('id,channel_id,sender_id,sender_name,content,created_at,pinned_at,reaction_users,image_path')
    .eq('channel_id', channelId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
  if (before) query = query.or(`created_at.lt.${before.sentAt},and(created_at.eq.${before.sentAt},id.lt.${before.id})`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).reverse().map(row => ({
    id: row.id, channelId: row.channel_id, senderId: row.sender_id, senderName: row.sender_name || 'Someone',
    content: row.content, createdAt: Date.parse(row.created_at), sentAt: row.created_at, pinned: Boolean(row.pinned_at), imagePath: row.image_path,
    reactions: Object.fromEntries(Object.entries((row.reaction_users || {}) as Record<string, Record<string, string>>)
      .map(([emoji, people]) => [emoji, Object.values(people)])),
  }));
}

export async function listPinnedMessages(channelId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('chat_messages')
    .select('id,channel_id,sender_id,sender_name,content,created_at,image_path')
    .eq('channel_id', channelId).not('pinned_at', 'is', null).order('pinned_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id, channelId: row.channel_id, senderId: row.sender_id, senderName: row.sender_name || 'Someone',
    content: row.content, createdAt: Date.parse(row.created_at), sentAt: row.created_at, pinned: true, reactions: {}, imagePath: row.image_path,
  }));
}

export async function readConversation(channelId: string, through: string) {
  const { error } = await supabase.rpc('read_message_conversation', {
    p_channel: channelId, p_through: through,
  });
  if (error) throw error;
}

export async function listChatPeople(channelId?: string): Promise<ChatPerson[]> {
  const { data, error } = await supabase.rpc('list_message_people', { p_channel: channelId ?? null });
  if (error) throw error;
  return data || [];
}

export async function openDirectConversation(personId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_direct_conversation', { p_person: personId });
  if (error) throw error;
  return data;
}

export async function setMessagePin(messageId: string, pin: boolean) {
  const { error } = await supabase.rpc('set_conversation_message_pin', { p_message: messageId, p_pin: pin });
  if (error) throw error;
}

export async function toggleMessageReaction(messageId: string, emoji: string) {
  const { error } = await supabase.rpc('toggle_conversation_reaction', { p_message: messageId, p_emoji: emoji });
  if (error) throw error;
}

export function subscribeToMessagesWorkspace(onChange: () => void, conversationId?: string) {
  const channel = supabase.channel('messages-workspace-' + crypto.randomUUID());
  if (conversationId) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: 'channel_id=eq.' + conversationId }, onChange);
  } else {
    for (const table of ['chat_messages', 'chat_channels']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
    }
  }
  channel.subscribe(status => { if (status === 'SUBSCRIBED') onChange(); });
  return () => { void supabase.removeChannel(channel); };
}
