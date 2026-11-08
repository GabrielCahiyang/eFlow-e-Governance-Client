import { useState } from 'react';
import { CornerUpLeft, Ellipsis, Pin, Smile } from 'lucide-react';
import { parseMessage } from '../services/chatMessageCodec';
import { splitMessageLinks } from '../services/sharedChatLinks';
import type { Message } from '../services/messagesWorkspace';
import { ConversationImage } from './ConversationImage';

const days = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'Asia/Manila' });
const times = new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: 'Asia/Manila' });
const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export function MessageHistory({ messages, userId, onReply, onReact, onPin, onDelete }: {
  messages: Message[]; userId?: string;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onPin: (message: Message) => void;
  onDelete: (message: Message) => void;
}) {
  const [menu, setMenu] = useState<{ message: string; kind: 'reactions' | 'actions' }>();
  const [viewingReaction, setViewingReaction] = useState<{ message: string; emoji: string }>();
  const toggle = (message: string, kind: 'reactions' | 'actions') => setMenu(current => current?.message === message && current.kind === kind ? undefined : { message, kind });
  return messages.map((message, index) => {
    const mine = message.senderId === userId;
    const parsed = parseMessage(message.content);
    const day = days.format(message.createdAt);
    const previous = messages[index - 1];
    const newDay = !previous || days.format(previous.createdAt) !== day;
    const grouped = !newDay && previous.senderId === message.senderId && message.createdAt - previous.createdAt < 5 * 60_000;
    const reactionKinds = new Set([...Object.keys(parsed.reactions || {}), ...Object.keys(message.reactions)]);
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
            {splitMessageLinks(parsed.text).map((part, partIndex) => part.href ? <a key={partIndex} href={part.href} target="_blank" rel="noreferrer">{part.text}</a> : <span key={partIndex}>{part.text}</span>)}
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
          <button type="button" className="messages-icon-button" aria-label="React to message" aria-expanded={menu?.message === message.id && menu.kind === 'reactions'} onClick={() => toggle(message.id, 'reactions')}><Smile size={16} /></button>
          <button type="button" className="messages-icon-button" aria-label="Reply to message" onClick={() => { setMenu(undefined); onReply(message); }}><CornerUpLeft size={16} /></button>
          <button type="button" className="messages-icon-button" aria-label="More message actions" aria-expanded={menu?.message === message.id && menu.kind === 'actions'} onClick={() => toggle(message.id, 'actions')}><Ellipsis size={18} /></button>
          {menu?.message === message.id && <div className="messages-action-menu">
            {menu.kind === 'reactions' ? emojis.map(emoji => <button type="button" key={emoji} aria-label={'React with ' + emoji} onClick={() => { setMenu(undefined); onReact(message, emoji); }}>{emoji}</button>) : <>
              <button type="button" onClick={() => { setMenu(undefined); onPin(message); }}>{message.pinned ? 'Unpin' : 'Pin message'}</button>
              {mine && <button type="button" onClick={() => { setMenu(undefined); onDelete(message); }}>Remove</button>}
            </>}
          </div>}
        </div>
      </div>
    </div>;
  });
}
