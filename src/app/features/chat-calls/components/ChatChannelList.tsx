import { useEffect, useState } from 'react';
import { Building2, ClipboardList, Folder, Pin, Search, SquarePen } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { parseMessage } from '../services/chatMessageCodec';
import type { Conversation } from '../services/messagesWorkspace';
import { ConversationImage } from './ConversationImage';
import { useMessages } from './MessagesContext';

const filters = [
  ['all', 'All'], ['group', 'Groups'], ['direct', 'People'], ['org', 'Office'], ['archive', 'Archived'],
] as const;

export function ConversationAvatar({ conversation }: { conversation: Conversation }) {
  const Icon = conversation.taskId ? ClipboardList : conversation.projectId ? Folder : conversation.orgId ? Building2 : null;
  return <span className="messages-avatar" data-kind={conversation.channelType} aria-hidden="true">
    {Icon ? <Icon size={20} /> : conversation.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
    {conversation.avatarPath && <ConversationImage path={conversation.avatarPath} avatar />}
  </span>;
}

export function ChatChannelList({ selected, onSelect, onCompose }: {
  selected?: string; onSelect: (id: string) => void; onCompose: () => void;
}) {
  const { conversations, loading, error, refresh } = useMessages();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const query = search.trim().toLocaleLowerCase();
  const selectedArchived = conversations.find(chat => chat.channelId === selected)?.archived;
  useEffect(() => {
    if (selectedArchived) setFilter('archive');
    else if (selected && selectedArchived === false) setFilter(current => current === 'archive' ? 'all' : current);
  }, [selected, selectedArchived]);
  const currentFilter = filter;
  const visible = conversations.filter(chat => (currentFilter === 'archive' ? chat.archived : !chat.archived &&
    (currentFilter === 'all' || chat.channelType === currentFilter || (currentFilter === 'group' && (chat.taskId || chat.projectId))))
    && (!query || [chat.name, chat.defaultName, chat.projectTitle, chat.lastMessage && parseMessage(chat.lastMessage).text]
      .some(value => value?.toLocaleLowerCase().includes(query))));
  const grouped = new Map<string, Conversation[]>();
  for (const chat of visible) {
    if (!chat.taskId || !chat.parentProjectId || chat.personalPin || query || currentFilter === 'archive') continue;
    if (!visible.some(parent => parent.projectId === chat.parentProjectId)) continue;
    const tasks = grouped.get(chat.parentProjectId) ?? [];
    tasks.push(chat);
    grouped.set(chat.parentProjectId, tasks);
  }
  const nested = new Set([...grouped.values()].flat().map(chat => chat.channelId));
  const pinned = visible.filter(chat => !chat.archived && (chat.projectId || chat.personalPin))
    .sort((a,b) => Number(Boolean(b.projectId))-Number(Boolean(a.projectId))
      || (b.personalPin ?? '').localeCompare(a.personalPin ?? ''));
  const pinnedIds = new Set(pinned.map(chat => chat.channelId));
  const renderChat = (chat: Conversation) => <button type="button" key={chat.channelId} className="messages-conversation"
    onClick={() => onSelect(chat.channelId)} aria-current={chat.channelId === selected ? 'page' : undefined}
    aria-label={chat.name + (chat.unread && !chat.archived ? ', unread' : '')} data-unread={chat.unread && !chat.archived || undefined}>
    <ConversationAvatar conversation={chat} />
    <span className="messages-conversation-copy">
      <span className="messages-conversation-name" title={chat.name}>{chat.name}</span>
      {chat.projectId && <span className="messages-conversation-project">Project chat{chat.defaultName && chat.defaultName !== chat.name ? ' · ' + chat.defaultName : ''}</span>}
      {chat.taskId && <span className="messages-conversation-project" title={chat.projectTitle}>Task chat{chat.projectTitle ? ' · ' + chat.projectTitle : ''}</span>}
      <span className="messages-preview">{chat.lastMessage ? parseMessage(chat.lastMessage).text : 'No messages yet'}</span>
    </span>
    <span className="messages-conversation-meta">
      {chat.lastMessageAt && <time dateTime={new Date(chat.lastMessageAt).toISOString()}>{new Date(chat.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}
      {chat.unread && !chat.archived && <span className="messages-unread-dot" aria-hidden="true" />}
    </span>
  </button>;

  return <aside className="messages-list" aria-label="Conversations">
    <header className="messages-list-header">
      <div className="messages-list-title"><h1>Messages</h1><button type="button" className="messages-icon-button messages-compose-new" onClick={onCompose} aria-label="New message"><SquarePen size={19} /></button></div>
      <label className="messages-search"><Search size={17} /><input type="search" aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="messages-filters" role="group" aria-label="Conversation filters">
        {filters.map(([key, label]) => <button type="button" key={key} aria-pressed={currentFilter === key} onClick={() => setFilter(key)}>
          {label}
        </button>)}
      </div>
    </header>
    <div className="messages-conversations eflow-scroll-region">
      {loading && !conversations.length && <div role="status" aria-label="Loading conversations">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="messages-conversation" aria-hidden="true">
          <span className="messages-avatar animate-pulse bg-muted motion-reduce:animate-none" />
          <span className="messages-conversation-copy space-y-2">
            <span className="block h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <span className="block h-2 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </span>
          <span className="h-2 w-6 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>)}
      </div>}
      {error && <p className="messages-list-state" role="alert">{error} <button type="button" onClick={() => void refresh()}>Retry</button></p>}
      {pinned.length > 0 && <section aria-label="Pinned conversations">
        <h2 className="messages-list-section"><Pin size={13} /> Pinned</h2>
        {pinned.map(chat => {
          const tasks = chat.projectId ? grouped.get(chat.projectId) : undefined;
          return <div key={chat.channelId}>{renderChat(chat)}{tasks && <details className="messages-task-chats"
            open={tasks.some(task => task.channelId === selected) || undefined}>
            <summary>Task chats ({tasks.length}) {tasks.some(task => task.unread) && <span className="messages-unread-dot" aria-label="Unread task chats" />}</summary>
            {[...tasks].sort((a,b) => Number(b.unread)-Number(a.unread)).map(renderChat)}
          </details>}</div>;
        })}
      </section>}
      {visible.filter(chat => !pinnedIds.has(chat.channelId) && !nested.has(chat.channelId)).map(renderChat)}
      {!loading && !error && visible.length === 0 && <EmptyState size="compact"
        illustration={query ? 'search' : currentFilter === 'archive' ? 'files' : 'chat'}
        title={query ? 'No conversations found' : currentFilter === 'archive' ? 'No archived chats yet' : 'No conversations yet'}
        description={!query && currentFilter === 'archive' ? 'Completed projects and their task chats appear here.' : undefined}
        action={query ? <button type="button" className="messages-task-link" onClick={() => setSearch('')}>Clear search</button> : undefined} />}
    </div>
  </aside>;
}
