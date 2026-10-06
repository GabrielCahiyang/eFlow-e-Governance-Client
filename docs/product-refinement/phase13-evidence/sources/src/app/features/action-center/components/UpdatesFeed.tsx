import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchRecentNotifications, markRecentNotificationRead, type Notification } from '../../../services/notificationService';
import { usePersonalFeed } from '../hooks/usePersonalFeed';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
export function UpdatesFeed({ onOpen }: { onOpen: (notification: Notification) => void }) {
  const { user } = useAuth();
  const feed = usePersonalFeed(user?.id,fetchRecentNotifications);
  const [unreadOnly,setUnreadOnly] = useState(false);
  const [readIds,setReadIds] = useState<string[]>([]);
  const [pending,setPending] = useState<string | null>(null);
  const [error,setError] = useState('');
  const pendingRef = useRef(false);
  const scopeRef = useRef(user?.id); scopeRef.current = user?.id;
  useEffect(() => {setReadIds([]);setPending(null);setError('');setUnreadOnly(false);},[user?.id]);
  const markRead = async (id: string) => {
    const recipient = user?.id;
    if (!recipient || pendingRef.current) return;
    pendingRef.current = true; setPending(id); setError('');
    try { await markRecentNotificationRead(recipient,id); if(scopeRef.current === recipient) setReadIds(current => [...current,id]); }
    catch(caught) {if(scopeRef.current === recipient) setError(caught instanceof Error ? caught.message : 'Could not mark this update read.');}
    finally {pendingRef.current=false;if(scopeRef.current === recipient)setPending(null);}
  };
  const rows = feed.rows.filter(item => !unreadOnly || (!item.read && !readIds.includes(item.id)));
  return <section className="space-y-3" aria-label="Recent updates">
    <div className="flex flex-wrap items-center gap-3"><p className="flex-1 text-sm text-muted-foreground">Latest 50 updates. Unread means unseen, not awaiting approval.</p><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={unreadOnly} onChange={event=>setUnreadOnly(event.target.checked)} />Unread only</label><Button variant="outline" disabled={feed.loading} onClick={feed.retry}>Refresh updates</Button></div>
    {error && <FeedbackState tone="error" title="Read state was not saved">{error} Retry the same update.</FeedbackState>}
    {feed.loading ? <p role="status">Loading recent updates…</p> : feed.error ? <FeedbackState tone="error" title="Updates could not be loaded" onRetry={feed.retry}>{feed.error}</FeedbackState> : !rows.length ? <FeedbackState title={unreadOnly ? 'No unread recent updates' : 'No recent updates'}>Older updates are outside this recent feed.</FeedbackState> : <ul className="rounded-lg border border-border divide-y divide-border bg-card">{rows.map(item=> {
      const read = item.read || readIds.includes(item.id);
      return <li key={item.id} className="p-4 space-y-2"><div className="flex gap-2 items-start"><h2 className="font-medium flex-1 min-w-0 break-words">{item.title}</h2><span className="text-xs text-muted-foreground shrink-0">{read?'Read':'Unread'}</span></div><p className="text-sm break-words">{item.message}</p><div className="flex flex-wrap gap-2"><Button data-update-id={item.id} variant="outline" onClick={()=>onOpen(item)}>Open update</Button>{!read && <Button variant="ghost" disabled={pending !== null} onClick={()=>void markRead(item.id)}>{pending===item.id?'Saving read state…':'Mark read'}</Button>}</div></li>;
    })}</ul>}
  </section>;
}
