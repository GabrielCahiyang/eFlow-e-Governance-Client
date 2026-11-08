import { useEffect, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { NAVIGATION_LOCATION_EVENT, pushNavigationHistory } from '../../../shared/navigationHistory';
import { ChatChannelList } from './ChatChannelList';
import { ActiveChatPanel } from './ActiveChatPanel';
import { useMessages } from './MessagesContext';
import { NewMessageDialog } from './NewMessageDialog';

function readSelection() {
  const query = new URLSearchParams(window.location.search);
  return { conversationId: query.get('conversation'), taskId: query.get('chatTask'), projectId: query.get('chatProject') };
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
  function select(id?: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete('chatTask');
    url.searchParams.delete('chatProject');
    if (id) url.searchParams.set('conversation', id);
    else url.searchParams.delete('conversation');
    if (url.href !== window.location.href) pushNavigationHistory(url.pathname + url.search);
    setSelection(readSelection());
  }
  const unavailable = !loading && !active && Boolean(selection.conversationId || selection.taskId || selection.projectId);

  return <div className="messages-workspace" data-selected={Boolean(active) || undefined}>
    <ChatChannelList selected={active?.channelId} onSelect={select} onCompose={() => setCompose(true)} />
    {active ? <ActiveChatPanel key={active.channelId} conversation={active} userId={userId} userName={userName} onBack={() => select()} onOpenTask={onOpenTask} onOpenProject={onOpenProject} />
      : <section className="messages-workspace-placeholder" aria-label="Messages workspace">
        <MessagesSquare size={32} aria-hidden="true" />
        <h2>{unavailable ? 'Conversation unavailable' : 'Your conversations'}</h2>
        <p>{unavailable ? 'This chat is unavailable with your current access.' : 'Select a chat to read and send messages.'}</p>
      </section>}
    {compose && <NewMessageDialog onClose={() => setCompose(false)} onOpen={async id => { await refresh(); select(id); setCompose(false); }} />}
  </div>;
}
