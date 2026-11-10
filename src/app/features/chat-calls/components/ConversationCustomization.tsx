import { useState } from 'react';
import { Pencil, UserRoundPen } from 'lucide-react';
import { editConversationGroup, setConversationNickname, type ChatPerson, type Conversation } from '../services/messagesWorkspace';
import { removeChatImage, uploadChatImage } from '../services/chatImages';

export function EditGroupChat({ conversation, userId, onChanged }: {
  conversation: Conversation; userId: string; onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File>();
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    let uploaded: string | undefined;
    try {
      if (photo) uploaded = await uploadChatImage(conversation.channelId, userId, photo, true);
      await editConversationGroup(conversation.channelId, name, uploaded ?? (reset ? null : conversation.avatarPath ?? null));
    } catch (failure) {
      if (uploaded) void removeChatImage(uploaded).catch(() => {});
      setError(failure instanceof Error ? failure.message : 'Could not save the group chat.');
      setBusy(false);
      return;
    }
    if ((uploaded || reset) && conversation.avatarPath) void removeChatImage(conversation.avatarPath).catch(() => {});
    setOpen(false);
    setBusy(false);
    await onChanged();
  }
  return open ? <form className="messages-settings-form" onSubmit={event => { event.preventDefault(); void save(); }}>
    <label>Chat name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder={conversation.defaultName} disabled={busy} /></label>
    <label>Group photo<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy}
      onChange={event => { setPhoto(event.target.files?.[0]); setReset(false); }} /></label>
    <div className="messages-settings-actions">
      <button type="button" disabled={busy} onClick={() => setName('')}>Use default name</button>
      {conversation.avatarPath && !photo && <button type="button" disabled={busy || reset} onClick={() => setReset(true)}>{reset ? 'Default photo selected' : 'Use default photo'}</button>}
    </div>
    {error && <p className="messages-error" role="alert">{error}</p>}
    <div className="messages-settings-actions">
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save group chat'}</button>
    </div>
  </form> : <button type="button" className="messages-task-link" onClick={() => {
    setName(conversation.name === conversation.defaultName ? '' : conversation.name);
    setPhoto(undefined); setReset(false); setError(''); setOpen(true);
  }}><Pencil size={14} /> Edit group chat</button>;
}

export function ConversationNicknames({ conversation, people, onChanged }: {
  conversation: Conversation; people: ChatPerson[]; onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(personId: string, value: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await setConversationNickname(conversation.channelId, personId, value);
      await onChanged();
      setEditing(undefined);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the nickname.'); }
    finally { setBusy(false); }
  }
  return <details><summary><UserRoundPen size={16} /> Nicknames</summary>
    <ul aria-label="Chat nicknames">{people.map(person => <li key={person.id}>
      <div className="messages-nickname-row">
        <span><strong>{person.nickname || person.name || 'Team member'}</strong>{person.nickname && <small>{person.name}</small>}</span>
        {!conversation.archived && (editing === person.id ? <form className="messages-settings-form" onSubmit={event => { event.preventDefault(); void save(person.id, draft); }}>
          <label>Nickname for {person.name}<input value={draft} onChange={event => setDraft(event.target.value)} maxLength={40} disabled={busy} /></label>
          <div className="messages-settings-actions">
            <button type="button" disabled={busy} onClick={() => setEditing(undefined)}>Cancel</button>
            {person.nickname && <button type="button" disabled={busy} onClick={() => void save(person.id, '')}>Clear nickname</button>}
            <button type="submit" disabled={busy}>Save nickname</button>
          </div>
          {error && <p className="messages-error" role="alert">{error}</p>}
        </form> : <button type="button" className="messages-icon-button" aria-label={'Edit nickname for ' + person.name} disabled={busy}
          onClick={() => { setDraft(person.nickname ?? ''); setError(''); setEditing(person.id); }}><Pencil size={15} /></button>)}
      </div>
    </li>)}</ul>
  </details>;
}
