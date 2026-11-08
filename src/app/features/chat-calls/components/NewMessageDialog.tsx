import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { listChatPeople, openDirectConversation, type ChatPerson } from '../services/messagesWorkspace';

export function NewMessageDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => Promise<void> }) {
  const [people, setPeople] = useState<ChatPerson[]>();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    listChatPeople().then(rows => { if (active) setPeople(rows); }).catch(() => { if (active) setError('Could not load people in your office.'); });
    return () => { active = false; };
  }, []);

  return <Modal isOpen onClose={() => { if (!busy) onClose(); }} title="New message" width="max-w-md">
    <label className="messages-search"><Search size={17} /><input type="search" aria-label="Search people" placeholder="Search people in your office" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {error && <p role="alert" className="messages-error">{error}</p>}
    <div className="messages-person-picker">
      {people?.filter(person => person.name?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(person =>
        <button type="button" key={person.id} disabled={busy} onClick={async () => {
          setBusy(true);
          setError('');
          try { await onOpen(await openDirectConversation(person.id)); }
          catch { setError('Could not open this conversation. Try again.'); }
          finally { setBusy(false); }
        }}>{person.name}</button>)}
      {!people && !error && <p role="status">Loading people…</p>}
      {people?.length === 0 && <p>There are no other active people in your office.</p>}
    </div>
  </Modal>;
}
