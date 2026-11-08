import { useState } from 'react';
import { Building2, ClipboardList, Folder, MessageCircle, Search, SquarePen } from 'lucide-react';
import { parseMessage } from '../services/chatMessageCodec';
import type { Conversation } from '../services/messagesWorkspace';
import { useMessages } from './MessagesContext';

const filters = [
  ['all', 'All'], ['group', 'Groups'], ['direct', 'People'], ['org', 'Office'],
] as const;

export function ConversationAvatar({ conversation }: { conversation: Conversation }) {
  const Icon = conversation.taskId ? ClipboardList : conversation.projectId ? Folder : conversation.orgId ? Building2 : null;
  return <span className="messages-avatar" data-kind={conversation.channelType} aria-hidden="true">
    {Icon ? <Icon size={20} /> : conversation.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
  </span>;
}

export function ChatChannelList({ selected, onSelect, onCompose }: {
  selected?: string; onSelect: (id: string) => void; onCompose: () => void;
}) {
  const { conversations, loading, error, refresh } = useMessages();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const query = search.trim().toLocaleLowerCase();
  const visible = conversations.filter(chat => (filter === 'all' || chat.channelType === filter || (filter === 'group' && (chat.taskId || chat.projectId)))
    && (!query || [chat.name, chat.projectTitle, chat.lastMessage && parseMessage(chat.lastMessage).text]
      .some(value => value?.toLocaleLowerCase().includes(query))));

  return <aside className="messages-list" aria-label="Conversations">
    <header className="messages-list-header">
      <div className="messages-list-title"><h1>Messages</h1><button type="button" className="messages-icon-button messages-compose-new" onClick={onCompose} aria-label="New message"><SquarePen size={19} /></button></div>
      <label className="messages-search"><Search size={17} /><input type="search" aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="messages-filters" role="group" aria-label="Conversation filters">
        {filters.map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
          {label}
        </button>)}
      </div>
    </header>
    <div className="messages-conversations eflow-scroll-region">
      {loading && <p className="messages-list-state" role="status">Loading conversations…</p>}
      {error && <p className="messages-list-state" role="alert">{error} <button type="button" onClick={() => void refresh()}>Retry</button></p>}
      {visible.map(chat => <button type="button" key={chat.channelId} className="messages-conversation"
        onClick={() => onSelect(chat.channelId)} aria-current={chat.channelId === selected ? 'page' : undefined}
        aria-label={chat.name + (chat.unread ? ', unread' : '')} data-unread={chat.unread || undefined}>
        <ConversationAvatar conversation={chat} />
        <span className="messages-conversation-copy">
          <span className="messages-conversation-name">{chat.name}</span>
          {chat.projectTitle && <span className="messages-conversation-project">{chat.projectTitle}</span>}
          <span className="messages-preview">{chat.lastMessage ? parseMessage(chat.lastMessage).text : 'No messages yet'}</span>
        </span>
        <span className="messages-conversation-meta">
          {chat.lastMessageAt && <time dateTime={new Date(chat.lastMessageAt).toISOString()}>{new Date(chat.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}
          {chat.unread && <span className="messages-unread-dot" aria-hidden="true" />}
        </span>
      </button>)}
      {!loading && !error && visible.length === 0 && <div className="messages-list-state"><MessageCircle size={24} /><p>{query || filter !== 'all' ? 'No matching conversations.' : 'No conversations yet.'}</p></div>}
    </div>
  </aside>;
}
