import { useCallback, useEffect, useRef, useState } from 'react';
import { useVisibleRead } from '../../../shared/useVisibleRead';
import { listMessages, listPinnedMessages, readConversation, refreshOlderMessages, subscribeToMessagesWorkspace, type Message } from '../services/messagesWorkspace';

export function useConversation(conversationId: string, unread: boolean, onRead: () => Promise<void>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [older, setOlder] = useState<Message[]>([]);
  const [pinned, setPinned] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [error, setError] = useState('');
  const loaded = useRef(0);
  const readThrough = useRef('');
  const olderRef = useRef(older);
  olderRef.current = older;
  const refresh = useCallback(async () => {
    const request = ++loaded.current;
    try {
      const previouslyLoaded = olderRef.current;
      const [latest, pins, prior] = await Promise.all([
        listMessages(conversationId), listPinnedMessages(conversationId), refreshOlderMessages(conversationId, previouslyLoaded),
      ]);
      if (request !== loaded.current) return;
      setMessages(latest);
      setPinned(pins);
      setOlder(current => current === previouslyLoaded ? prior : current);
      if (latest.length < 100) setHasOlder(false);
      setError('');
    } catch {
      if (request === loaded.current) setError('Could not load this conversation.');
    } finally {
      if (request === loaded.current) setLoading(false);
    }
  }, [conversationId]);
  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeToMessagesWorkspace(() => void refresh(), conversationId);
    return () => { ++loaded.current; unsubscribe(); };
  }, [conversationId, refresh]);
  useVisibleRead(() => void refresh());

  const markRead = useCallback(async () => {
    const through = messages[messages.length - 1]?.sentAt;
    if (!through || !unread || through === readThrough.current || document.visibilityState !== 'visible') return;
    readThrough.current = through;
    try { await readConversation(conversationId, through); await onRead(); }
    catch { readThrough.current = ''; }
  }, [conversationId, messages, onRead, unread]);
  const loadOlder = async () => {
    const first = older[0] || messages[0];
    if (!first || loadingOlder || !hasOlder) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(conversationId, first);
      setOlder(previous => [...page, ...previous]);
      setHasOlder(page.length === 100);
    } catch { setError('Could not load earlier messages.'); }
    finally { setLoadingOlder(false); }
  };

  const history = [...older.filter(message => !messages.some(latest => latest.id === message.id)), ...messages];
  return { history, pinned, loading, loadingOlder, error, hasOlder, loadOlder, refresh, markRead, messages };
}
