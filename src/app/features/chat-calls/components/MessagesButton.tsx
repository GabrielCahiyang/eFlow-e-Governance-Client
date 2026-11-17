import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { MessageCircle } from 'lucide-react';
import { useMessages } from './MessagesContext';

export function MessagesButton({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  const { conversations } = useMessages();
  const unread = conversations.filter(conversation => conversation.unread && !conversation.archived).length;
  const unreadLabel = unread + (unread === 1 ? ' unread conversation' : ' unread conversations');
  return <WorkspaceTooltip content="Messages"><button type="button" className="messages-topbar-button" onClick={onOpen}
    aria-current={active ? 'page' : undefined}
    aria-label={unread ? 'Open messages, ' + unreadLabel : 'Open messages'}
    >
    <MessageCircle size={17} aria-hidden="true" />
    {unread > 0 && <span className="messages-unread-dot" aria-hidden="true" />}
  </button></WorkspaceTooltip>;
}
