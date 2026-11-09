import { useState, type RefObject } from 'react';
import { CornerUpLeft, Ellipsis, Pin, Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { parseMessage, type ParsedMessage } from '../services/chatMessageCodec';
import { mentionHighlights } from '../services/chatMentions';
import { splitMessageLinks } from '../services/sharedChatLinks';
import type { Message } from '../services/messagesWorkspace';
import { ConversationImage } from './ConversationImage';

const days = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'Asia/Manila' });
const times = new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: 'Asia/Manila' });
const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export function MessageHistory({ messages, userId, group, historyRef, onReply, onReact, onPin, onDelete }: {
  messages: Message[]; userId?: string; group: boolean;
  historyRef: RefObject<HTMLDivElement | null>;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onPin: (message: Message) => void;
  onDelete: (message: Message) => void;
}) {
  const [menu, setMenu] = useState<{ message: string; kind: 'reactions' | 'actions' }>();
  const [viewingReaction, setViewingReaction] = useState<{ message: string; emoji: string }>();
  return messages.map((message, index) => {
    const mine = message.senderId === userId;
    const parsed = parseMessage(message.content);
    const day = days.format(message.createdAt);
    const previous = messages[index - 1];
    const newDay = !previous || days.format(previous.createdAt) !== day;
    const grouped = !newDay && previous.senderId === message.senderId && message.createdAt - previous.createdAt < 5 * 60_000;
    const reactionKinds = new Set([...Object.keys(parsed.reactions || {}), ...Object.keys(message.reactions)]);
    const reactionsOpen = menu?.message === message.id && menu.kind === 'reactions';
    const actionsOpen = menu?.message === message.id && menu.kind === 'actions';
    return <div key={message.id}>
      {newDay && <div className="messages-date-divider"><time dateTime={message.sentAt}>{day}</time></div>}
      <div className="messages-message" data-mine={mine || undefined} data-grouped={grouped || undefined} id={'message-' + message.id} tabIndex={-1}
        onKeyDown={event => { if (event.key === 'Escape') setMenu(undefined); }}>
        {!mine && <span className="messages-person-initial" aria-hidden="true">{!grouped && message.senderName.slice(0, 1)}</span>}
        <div className="messages-bubble-stack">
          {!grouped && <span className="messages-sender">{mine ? 'You' : message.senderName} <time dateTime={message.sentAt}>{times.format(message.createdAt)}</time></span>}
          {parsed.replyToText && <div className="messages-reply-preview"><strong>{parsed.replyToName}</strong><span>{parsed.replyToText}</span></div>}
          <div className="messages-bubble" title={times.format(message.createdAt)}>
            {message.pinned && <Pin size={13} aria-label="Pinned" />}
            {message.imagePath && <ConversationImage path={message.imagePath} />}
            <MessageText message={parsed} group={group} />
          </div>
          {reactionKinds.size > 0 && <div className="messages-reaction-counts">{[...reactionKinds].map(emoji => {
            const people = [...(parsed.reactions?.[emoji] || []), ...(message.reactions[emoji] || [])];
            const expanded = viewingReaction?.message === message.id && viewingReaction.emoji === emoji;
            return people.length > 0 && <div key={emoji} className="messages-reaction-detail"><button type="button" aria-expanded={expanded}
              aria-label={emoji + ' reactions'} onClick={() => setViewingReaction(expanded ? undefined : { message: message.id, emoji })}>{emoji} {people.length}</button>
              {expanded && <span className="messages-reaction-people">{people.join(', ')}</span>}
            </div>;
          })}</div>}
        </div>
        <div className="messages-message-actions" data-open={menu?.message === message.id || undefined}>
          <Popover open={reactionsOpen} onOpenChange={open => {
            if (open) setMenu({ message: message.id, kind: 'reactions' });
            else setMenu(current => current?.message === message.id && current.kind === 'reactions' ? undefined : current);
          }}>
            <PopoverTrigger asChild><button type="button" className="messages-icon-button" aria-label="React to message"><Smile size={16} /></button></PopoverTrigger>
            <PopoverContent className="messages-reaction-picker" aria-label="Choose an emoji reaction" side="top"
              sideOffset={7} collisionBoundary={historyRef.current ?? undefined} collisionPadding={8} hideWhenDetached>
              {emojis.map(emoji => <button type="button" key={emoji} aria-label={'React with ' + emoji}
                onClick={() => { setMenu(undefined); onReact(message, emoji); }}>{emoji}</button>)}
            </PopoverContent>
          </Popover>
          <button type="button" className="messages-icon-button" aria-label="Reply to message" onClick={() => { setMenu(undefined); onReply(message); }}><CornerUpLeft size={16} /></button>
          <button type="button" className="messages-icon-button" aria-label="More message actions" aria-expanded={actionsOpen} onClick={() => setMenu(actionsOpen ? undefined : { message: message.id, kind: 'actions' })}><Ellipsis size={18} /></button>
          {actionsOpen && <div className="messages-action-menu">
            <button type="button" onClick={() => { setMenu(undefined); onPin(message); }}>{message.pinned ? 'Unpin' : 'Pin message'}</button>
            {mine && <button type="button" onClick={() => { setMenu(undefined); onDelete(message); }}>Remove</button>}
          </div>}
        </div>
      </div>
    </div>;
  });
}

function MessageText({ message, group }: { message: ParsedMessage; group: boolean }) {
  const parts: { text: string; href?: string; mention?: boolean }[] = [];
  let cursor = 0;
  for (const { start, label } of mentionHighlights(message.text, message.mentions ?? [], group)) {
    if (start < cursor) continue;
    parts.push(...splitMessageLinks(message.text.slice(cursor, start)), { text: label, mention: true });
    cursor = start + label.length;
  }
  parts.push(...splitMessageLinks(message.text.slice(cursor)));
  return parts.map((part, index) => part.href
    ? <a key={index} href={part.href} target="_blank" rel="noreferrer">{part.text}</a>
    : <span key={index} className={part.mention ? 'messages-mention-text' : undefined}>{part.text}</span>);
}
