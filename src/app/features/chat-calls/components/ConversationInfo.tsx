import { ArrowUpRight, ExternalLink, Pin, Users, X } from 'lucide-react';
import type { ChatPerson, Conversation, Message } from '../services/messagesWorkspace';
import { parseMessage } from '../services/chatMessageCodec';
import { sharedLinkType, splitMessageLinks } from '../services/sharedChatLinks';
import { ConversationAvatar } from './ChatChannelList';
import { ConversationImage } from './ConversationImage';
import { ConversationNicknames, EditGroupChat } from './ConversationCustomization';

export function ConversationInfo({ conversation, messages, pinned, userId, people, peopleError, onChanged, onClose, onOpenTask, onOpenProject, onShowPinned }: {
  conversation: Conversation; messages: Message[]; pinned: Message[];
  userId?: string; people?: ChatPerson[]; peopleError: boolean; onChanged: () => Promise<void>;
  onClose: () => void; onOpenTask: (id: string) => void; onOpenProject: (id: string) => void; onShowPinned: (message: Message) => void;
}) {
  const links = [...new Set(messages.flatMap(message => splitMessageLinks(parseMessage(message.content).text)
    .flatMap(part => part.href ? [part.href] : [])))].reverse();
  const images = messages.filter(message => message.imagePath);

  return <aside className="messages-info eflow-scroll-region" aria-label="Chat info">
    <header className="messages-info-header"><h2>Chat info</h2><button type="button" className="messages-icon-button" aria-label="Close chat info" onClick={onClose}><X size={18} /></button></header>
    <div className="messages-info-identity">
      <ConversationAvatar conversation={conversation} />
      <strong>{conversation.name}</strong>
      {conversation.projectTitle && <span>{conversation.projectTitle}</span>}
      {conversation.taskId && <button type="button" className="messages-task-link" onClick={() => onOpenTask(conversation.taskId!)}>Open task <ArrowUpRight size={15} /></button>}
      {conversation.projectId && <button type="button" className="messages-task-link" onClick={() => onOpenProject(conversation.projectId!)}>Open project <ArrowUpRight size={15} /></button>}
      {conversation.canEditGroup && !conversation.archived && userId && <EditGroupChat conversation={conversation} userId={userId} onChanged={onChanged} />}
    </div>
    <details open><summary><Users size={16} /> {conversation.orgId ? 'Office participants' : 'Members'} {people && <span>{people.length}</span>}</summary>
      {peopleError ? <p>Could not load chat members.</p> : !people ? <p>Loading members…</p> : <ul aria-label="Chat members">
        {people.map(person => <li key={person.id}><span className="messages-person-initial" aria-hidden="true">{(person.name || '?').slice(0, 1)}</span>
          <span>{person.nickname || person.name || 'Team member'}{person.nickname && <small>{person.name}</small>}{person.is_lead && <small>Task lead</small>}</span></li>)}
      </ul>}
    </details>
    {(conversation.projectId || conversation.taskId) && people && <ConversationNicknames conversation={conversation} people={people} onChanged={onChanged} />}
    <details open><summary><Pin size={16} /> Pinned messages <span>{pinned.length}</span></summary>
      {pinned.length ? <ul>{pinned.map(message => <li key={message.id}><button className="messages-pinned-item" type="button" onClick={() => onShowPinned(message)}><strong>{message.senderName}</strong><span>{parseMessage(message.content).text}</span></button></li>)}</ul> : <p>No pinned messages.</p>}
    </details>
    <details><summary><ExternalLink size={16} /> Media, files and links</summary>
      {(['Media', 'Files', 'Links'] as const).map(group => {
        const groupLinks = links.filter(link => sharedLinkType(link) === group);
        const hasImages = group === 'Media' && images.length > 0;
        return <div className="messages-shared" key={group}><h3>{group}</h3>
          {hasImages && <div className="messages-gallery">{images.map(message => <ConversationImage key={message.id} path={message.imagePath!} thumbnail />)}</div>}
          {groupLinks.length > 0 && <ul>{groupLinks.map(link => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul>}
          {!hasImages && groupLinks.length === 0 && <p>No shared {group.toLowerCase()} in loaded messages.</p>}
        </div>;
      })}
    </details>
  </aside>;
}
