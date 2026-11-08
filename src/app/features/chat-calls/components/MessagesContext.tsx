import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useVisibleRead } from '../../../shared/useVisibleRead';
import { CallModal } from '../../../components/ui/CallModal';
import type { ActiveCall } from '../../../services/callService';
import { listConversations, subscribeToMessagesWorkspace, type Conversation } from '../services/messagesWorkspace';

const MessagesContext = createContext<{
  conversations: Conversation[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  outgoingCall?: ActiveCall;
  setOutgoingCall: (call?: ActiveCall) => void;
} | null>(null);

export function MessagesProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState('');
  const [outgoingCall, setOutgoingCall] = useState<ActiveCall>();
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const request = ++version.current;
    try {
      const next = await listConversations();
      if (request !== version.current) return;
      setConversations(next);
      setError('');
    } catch {
      if (request === version.current) setError('Could not load conversations.');
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToMessagesWorkspace(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = undefined; void refresh(); }, 150);
    });
    return () => { ++version.current; clearTimeout(timer); unsubscribe(); };
  }, [userId, refresh]);

  useVisibleRead(() => void refresh(), Boolean(userId));
  return <MessagesContext.Provider value={{ conversations, loading, error, refresh, outgoingCall, setOutgoingCall }}>
    {children}
    {outgoingCall && <CallModal call={outgoingCall} isCaller onClose={() => setOutgoingCall(undefined)} />}
  </MessagesContext.Provider>;
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) throw new Error('MessagesProvider is required');
  return context;
}
