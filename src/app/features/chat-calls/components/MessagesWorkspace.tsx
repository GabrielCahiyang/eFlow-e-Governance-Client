import { useEffect, useState } from 'react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { NAVIGATION_LOCATION_EVENT, pushNavigationHistory } from '../../../shared/navigationHistory';
import { useNotificationNavigationIntent } from '../../notifications';
import { ChatChannelList } from './ChatChannelList';
import { ActiveChatPanel } from './ActiveChatPanel';
import { useMessages } from './MessagesContext';
import { NewMessageDialog } from './NewMessageDialog';

function readSelection() {
  const query = new URLSearchParams(window.location.search);
  return { conversationId: query.get('conversation'), taskId: query.get('chatTask'), projectId: query.get('chatProject'), messageId: query.get('message') };
}

export function MessagesWorkspace({ userId, userName, onOpenTask, onOpenProject }: { userId?: string; userName?: string; onOpenTask: (taskId: string) => void; onOpenProject: (projectId: string) => void }) {
  const [selection, setSelection] = useState(readSelection);
  const [compose, setCompose] = useState(false);
  const { conversations, loading, refresh } = useMessages();
  useEffect(() => {
    const sync = () => setSelection(readSelection());
    window.addEventListener(NAVIGATION_LOCATION_EVENT, sync);
    return () => window.removeEventListener(NAVIGATION_LOCATION_EVENT, sync);
  }, []);
  useEffect(() => { void refresh(); }, [refresh, selection.taskId, selection.projectId]);

  const active = conversations.find(chat => selection.conversationId ? chat.channelId === selection.conversationId
    : selection.taskId ? chat.taskId === selection.taskId : Boolean(selection.projectId && chat.projectId === selection.projectId));
  function select(id?: string, messageId?: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete('chatTask');
    url.searchParams.delete('chatProject');
    if (id) url.searchParams.set('conversation', id);
    else url.searchParams.delete('conversation');
    if (messageId) url.searchParams.set('message', messageId);
    else url.searchParams.delete('message');
    if (url.href !== window.location.href) pushNavigationHistory(url.pathname + url.search);
    setSelection(readSelection());
  }
  useNotificationNavigationIntent(
    intent => intent.kind === 'conversation' && Boolean(intent.conversationId),
    intent => { select(intent.conversationId, intent.conversationMessageId); return true; },
    [],
  );
  const unavailable = !loading && !active && Boolean(selection.conversationId || selection.taskId || selection.projectId);

  return <div className="messages-workspace" data-selected={Boolean(active) || undefined}>
    <ChatChannelList selected={active?.channelId} onSelect={select} onCompose={() => setCompose(true)} />
    {active ? <ActiveChatPanel key={active.channelId} conversation={active} userId={userId} userName={userName}
      targetMessageId={selection.messageId ?? undefined} onClearTarget={() => select(active.channelId)}
      onBack={() => select()} onOpenTask={onOpenTask} onOpenProject={onOpenProject} />
      : <section className="messages-workspace-placeholder" aria-label="Messages workspace">
        <EmptyState illustration="chat" title={unavailable ? 'Conversation unavailable' : 'Choose a conversation'}
          description={unavailable ? 'This chat is unavailable with your current access.' : 'Open a chat from the sidebar or start a new message.'} />
      </section>}
    {compose && <NewMessageDialog onClose={() => setCompose(false)} onOpen={async id => { await refresh(); select(id); setCompose(false); }} />}
  </div>;
}
