import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { AtSign, Users } from 'lucide-react';
import { CHAT_TEXT_LIMIT, editChatDraft, findMentionQuery, insertChatMention, type ChatDraft, type MentionQuery } from '../services/chatMentions';
import { listChatPeople, type ChatPerson } from '../services/messagesWorkspace';

export function ChatMentionInput({ composer, draft, setDraft, channelId, userId, group, disabled, onSend }: {
  composer: RefObject<HTMLTextAreaElement | null>;
  draft: ChatDraft;
  setDraft: (draft: ChatDraft) => void;
  channelId: string;
  userId?: string;
  group: boolean;
  disabled: boolean;
  onSend: () => void;
}) {
  const menuId = useId();
  const [query, setQuery] = useState<MentionQuery>();
  const [people, setPeople] = useState<ChatPerson[]>();
  const [peopleError, setPeopleError] = useState(false);
  const [active, setActive] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const caret = useRef<number | undefined>(undefined);
  const open = Boolean(query) && !disabled;
  const term = query?.term.toLocaleLowerCase() ?? '';
  const matches = (people ?? []).filter(person => person.id !== userId && person.name
    && [person.name, person.nickname].some(name => name?.toLocaleLowerCase().includes(term)));
  const options = [
    ...(group && 'everyone'.startsWith(term) ? [{ id: '', name: 'everyone', nickname: undefined }] : []),
    ...matches.slice(0, 8),
  ];
  const activeIndex = Math.min(active, options.length - 1);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setPeopleError(false);
    listChatPeople(channelId).then(result => { if (current) setPeople(result); })
      .catch(() => { if (current) { setPeople([]); setPeopleError(true); } });
    return () => { current = false; };
  }, [channelId, open]);

  useEffect(() => {
    if (caret.current === undefined) return;
    composer.current?.focus();
    composer.current?.setSelectionRange(caret.current, caret.current);
    caret.current = undefined;
  }, [composer, draft]);

  function updateQuery(input: HTMLTextAreaElement, current: ChatDraft) {
    const position = input.selectionStart;
    const insideMention = current.mentions.some(mention => position > mention.start && position <= mention.start + mention.label.length);
    const next = position === input.selectionEnd && !insideMention ? findMentionQuery(current.text, position) : undefined;
    if (next?.start === query?.start && next?.end === query?.end && next?.term === query?.term) return;
    setQuery(next);
    setActive(0);
  }

  function pick(option: (typeof options)[number]) {
    if (!query || !option.name) return;
    const inserted = insertChatMention(draft, query, '@' + option.name, option.id || undefined);
    if (!inserted) return;
    caret.current = inserted.caret;
    setQuery(undefined);
    setDraft(inserted.draft);
  }

  return <div className="messages-mention-input">
    {open && <div className="messages-mention-menu">
      <div className="messages-mention-heading" id={menuId + '-heading'}>Mention in this chat</div>
      <div role="listbox" aria-labelledby={menuId + '-heading'} id={menuId} className="messages-mention-options">
        {options.map((option, index) => <button key={option.id || 'everyone'} ref={button => { optionRefs.current[index] = button; }}
          id={menuId + '-' + index} role="option" aria-selected={index === activeIndex} tabIndex={-1} type="button"
          onMouseDown={event => event.preventDefault()} onClick={() => pick(option)}>
          <span className="messages-mention-icon">{option.id ? <AtSign size={16} /> : <Users size={16} />}</span>
          <span><strong>{option.id ? option.nickname || option.name : '@everyone'}</strong>
            {!option.id ? <small>Notify everyone in this chat</small> : option.nickname && <small>{option.name}</small>}</span>
        </button>)}
      </div>
      {peopleError ? <p role="status">Couldn’t load chat members. Type @ again to retry.</p>
        : !people ? <p role="status">Loading chat members…</p>
        : !options.length && <p role="status">No matching chat members.</p>}
    </div>}
    <textarea ref={composer} aria-label="Message" placeholder="Write a message…" value={draft.text}
      rows={1} maxLength={CHAT_TEXT_LIMIT} disabled={disabled} aria-autocomplete="list"
      aria-controls={open ? menuId : undefined} aria-activedescendant={open && activeIndex >= 0 ? menuId + '-' + activeIndex : undefined}
      onBlur={() => setQuery(undefined)}
      onSelect={event => updateQuery(event.currentTarget, draft)}
      onChange={event => {
        const next = editChatDraft(draft, event.currentTarget.value);
        setDraft(next);
        updateQuery(event.currentTarget, next);
      }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (open && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setQuery(undefined);
        } else if (open && options.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          const next = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
          setActive(next);
          optionRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (open && activeIndex >= 0) pick(options[activeIndex]);
          else onSend();
        }
      }} />
  </div>;
}
