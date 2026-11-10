import { useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ImagePlus, Info, Phone, Pin, Send, Video, X } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { deleteMessage, sendMessage } from '../../../services/chatService';
import { initiateCall } from '../../../services/callService';
import { useConversation } from '../hooks/useConversation';
import { parseMessage } from '../services/chatMessageCodec';
import { readChatMentions, type ChatDraft } from '../services/chatMentions';
import { listChatPeople, readChatMessage, setConversationPin, setMessagePin, toggleMessageReaction, type ChatPerson, type Conversation, type Message } from '../services/messagesWorkspace';
import { ConversationAvatar } from './ChatChannelList';
import { ConversationInfo } from './ConversationInfo';
import { MessageHistory } from './MessageHistory';
import { useMessages } from './MessagesContext';
import { removeChatImage, uploadChatImage, validateChatImage } from '../services/chatImages';
import { ConversationImage } from './ConversationImage';
import { ChatMentionInput } from './ChatMentionInput';

export function ActiveChatPanel({ conversation, userId, userName, targetMessageId, onClearTarget, onBack, onOpenTask, onOpenProject }: {
  conversation: Conversation; userId?: string; userName?: string;
  onBack: () => void; onOpenTask: (id: string) => void; onOpenProject: (id: string) => void;
  targetMessageId?: string; onClearTarget: () => void;
}) {
  const { refresh: refreshList, outgoingCall, setOutgoingCall } = useMessages();
  const thread = useConversation(conversation.channelId, conversation.unread, refreshList);
  const [showInfo, setShowInfo] = useState(false);
  const [draft, setDraft] = useState<ChatDraft>({ text: '', mentions: [] });
  const [image, setImage] = useState<{ file: File; preview: string }>();
  const [reply, setReply] = useState<Message>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedPinId, setSelectedPin] = useState<string>();
  const selectedPin = thread.pinned.find(message => message.id === selectedPinId);
  const [people, setPeople] = useState<ChatPerson[]>();
  const [peopleError, setPeopleError] = useState(false);
  const [rosterRevision, setRosterRevision] = useState(0);
  const [targetResult, setTargetResult] = useState<{ id: string; message?: Message }>();
  const confirmation = useConfirmation();
  const historyRef = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const nearBottom = useRef(true);
  const group = conversation.channelType !== 'direct';
  const parentProject = conversation.parentProjectId ?? conversation.projectId;
  const latest = thread.history[thread.history.length - 1];
  const activity = thread.messages.filter(message => message.activity);
  const latestActivity = activity[activity.length - 1]?.id;
  const nicknames = Object.fromEntries((people ?? []).flatMap(person => person.nickname ? [[person.id, person.nickname]] : []));
  const targetInHistory = Boolean(targetMessageId && thread.history.some(message => message.id === targetMessageId));
  const target = targetResult?.id === targetMessageId ? targetResult : undefined;
  const replyPreview = reply && (thread.history.find(message => message.id === reply.id) ?? reply);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.preview); }, [image]);

  useEffect(() => {
    if (!showInfo && !conversation.taskId && !conversation.projectId) return;
    let current = true;
    setPeopleError(false);
    listChatPeople(conversation.channelId).then(result => { if (current) setPeople(result); })
      .catch(() => { if (current) { setPeople(undefined); setPeopleError(true); } });
    return () => { current = false; };
  }, [conversation.channelId, conversation.taskId, conversation.projectId, latestActivity, rosterRevision, showInfo]);

  useEffect(() => {
    if (!targetMessageId || targetInHistory || thread.loading) return;
    let current = true;
    readChatMessage(conversation.channelId, targetMessageId)
      .then(message => { if (current) setTargetResult({ id: targetMessageId, message }); })
      .catch(() => { if (current) setTargetResult({ id: targetMessageId }); });
    return () => { current = false; };
  }, [conversation.channelId, targetMessageId, targetInHistory, thread.loading, thread.messages]);

  useEffect(() => {
    if (!targetMessageId) return;
    const row = document.getElementById('message-' + targetMessageId);
    if (row && historyRef.current?.contains(row)) {
      nearBottom.current = false;
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: 'center' });
    }
  }, [targetMessageId, targetInHistory, target?.message]);

  useEffect(() => {
    const history = historyRef.current;
    if (history && nearBottom.current && !targetMessageId) history.scrollTop = history.scrollHeight;
  }, [latest?.id, targetMessageId]);
  useEffect(() => {
    const checkRead = () => {
      if (nearBottom.current && historyRef.current?.getClientRects().length) void thread.markRead();
    };
    checkRead();
    window.addEventListener('focus', checkRead);
    window.addEventListener('resize', checkRead);
    document.addEventListener('visibilitychange', checkRead);
    return () => {
      window.removeEventListener('focus', checkRead);
      window.removeEventListener('resize', checkRead);
      document.removeEventListener('visibilitychange', checkRead);
    };
  }, [thread.markRead, showInfo]);

  async function send() {
    if (!userId || conversation.archived || sending.current || (!draft.text.trim() && !image)) return;
    sending.current = true;
    setBusy(true);
    setError('');
    let uploaded: string | undefined;
    try {
      const text = draft.text.trim();
      const leadingSpace = draft.text.length - draft.text.trimStart().length;
      const mentions = readChatMentions(draft.mentions.map(mention => ({ ...mention, start: mention.start - leadingSpace })), text);
      const content = reply || mentions.length ? JSON.stringify({
        text,
        ...(mentions.length ? { mentions } : {}),
        ...(reply ? { replyToId: reply.id } : {}),
      }) : text;
      if (image) uploaded = await uploadChatImage(conversation.channelId, userId, image.file);
      await sendMessage(conversation.channelId, userId, userName || 'Someone', content, uploaded);
      setImage(undefined);
      setDraft({ text: '', mentions: [] });
      setReply(undefined);
      nearBottom.current = true;
      await thread.refresh();
    } catch (failure) {
      if (uploaded) void removeChatImage(uploaded).catch(() => {});
      setError(errorMessage(failure, 'Could not send your message.'));
    } finally { sending.current = false; setBusy(false); }
  }

  async function run(action: () => Promise<void>) {
    setError('');
    try { await action(); await thread.refresh(); }
    catch (failure) { setError(errorMessage(failure, 'Could not update this message.')); }
  }

  async function startCall(callType: 'audio' | 'video') {
    if (!userId || !conversation.otherUserId || outgoingCall) return;
    const callerName = userName || 'Someone';
    try {
      const id = await initiateCall(conversation.channelId, userId, callerName, conversation.otherUserId, conversation.name, callType);
      setOutgoingCall({ id, channelId: conversation.channelId, callerId: userId, callerName,
        calleeId: conversation.otherUserId, calleeName: conversation.name, callType, status: 'ringing' });
    } catch (failure) { setError(errorMessage(failure, 'Could not start the call.')); }
  }

  function showPinned(message: Message) {
    const row = document.getElementById('message-' + message.id);
    if (row && historyRef.current?.contains(row) && !window.matchMedia('(max-width: 780px)').matches) {
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: 'center' });
    } else setSelectedPin(message.id);
  }

  return <div className="messages-active-layout" data-show-info={showInfo || undefined}>
    <section className="messages-thread" aria-label={'Conversation with ' + conversation.name}>
      <header className="messages-thread-header">
        <button type="button" className="messages-icon-button messages-back" aria-label="Back to conversations" onClick={onBack}><ArrowLeft size={20} /></button>
        <ConversationAvatar conversation={conversation} />
        <div className="messages-thread-identity">
          <h2>{conversation.name}</h2>
          <p>{conversation.taskId ? ['Task chat', conversation.projectTitle].filter(Boolean).join(' · ')
            : conversation.projectId ? ['Project chat', conversation.defaultName !== conversation.name && conversation.defaultName].filter(Boolean).join(' · ')
            : conversation.orgId ? 'Office channel' : 'Direct message'}</p>
        </div>
        <div className="messages-thread-tools">
          {!conversation.archived && !conversation.projectId && <button type="button" className="messages-icon-button"
            aria-label={conversation.personalPin ? 'Unpin chat' : 'Pin chat'} title={conversation.personalPin ? 'Unpin chat' : 'Pin chat'}
            aria-pressed={Boolean(conversation.personalPin)} onClick={() => void run(async () => {
              await setConversationPin(conversation.channelId, !conversation.personalPin); await refreshList();
            })}><Pin size={17} /></button>}
          {conversation.channelType === 'direct' && conversation.otherUserId && <>
            <button type="button" className="messages-icon-button" aria-label="Start audio call" onClick={() => void startCall('audio')}><Phone size={18} /></button>
            <button type="button" className="messages-icon-button" aria-label="Start video call" onClick={() => void startCall('video')}><Video size={19} /></button>
          </>}
          <button type="button" className="messages-icon-button" aria-label="Chat info" aria-expanded={showInfo} onClick={() => setShowInfo(value => !value)}><Info size={20} /></button>
        </div>
      </header>
      {conversation.archived && <div className="messages-archive-banner"><Archive size={17} />
        <span>{conversation.projectTitle || 'This project'} {conversation.completedAt ? 'was completed on ' +
          new Date(conversation.completedAt).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'Asia/Manila' }) : 'is closed'}. This chat is archived.</span>
        {parentProject && <button type="button" className="messages-task-link" onClick={() => onOpenProject(parentProject)}>Open project</button>}
      </div>}
      {thread.pinned[0] && <button type="button" className="messages-pinned-bar" onClick={() => showPinned(thread.pinned[0])}><Pin size={15} /><span>{parseMessage(thread.pinned[0].content).text || 'Shared image'}</span><small>{thread.pinned.length} pinned</small></button>}
      <div className="messages-history eflow-scroll-region" ref={historyRef}
        onScroll={event => {
          const el = event.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
          if (nearBottom.current) void thread.markRead();
        }}>
        {thread.loading ? <p role="status" className="messages-list-state">Loading messages…</p> : null}
        {thread.error && <p role="alert" className="messages-error">{thread.error} <button type="button" onClick={() => void thread.refresh()}>Retry</button></p>}
        {targetMessageId && <div className="messages-target-bar">
          <span>{targetInHistory || target?.message ? 'Mentioned message' : target ? 'Message unavailable' : 'Finding message…'}</span>
          <button type="button" className="messages-task-link" onClick={() => { nearBottom.current = true; onClearTarget(); }}>Jump to latest</button>
        </div>}
        {(!targetMessageId || targetInHistory) && !thread.loading && thread.hasOlder && thread.history.length > 0 && <button type="button" className="messages-earlier" disabled={thread.loadingOlder} onClick={async () => {
          const el = historyRef.current;
          const height = el?.scrollHeight || 0;
          nearBottom.current = false;
          await thread.loadOlder();
          requestAnimationFrame(() => { if (el) el.scrollTop += el.scrollHeight - height; });
        }}>{thread.loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
        {!targetMessageId && !thread.loading && !thread.error && thread.history.length === 0 && <div className="messages-empty-thread">
          <EmptyState illustration="chat" title={conversation.archived ? 'No messages in this chat' : 'Start the conversation'}
            description={conversation.archived ? undefined : conversation.taskId ? 'Share the first update about this task.' : 'Send the first message to get things started.'} />
        </div>}
        <MessageHistory messages={targetMessageId && !targetInHistory ? (target?.message ? [target.message] : []) : thread.history}
          userId={userId} group={group} historyRef={historyRef} nicknames={nicknames} highlightedId={targetMessageId} readOnly={conversation.archived}
          onReply={message => { setReply(message); composer.current?.focus(); }}
          onReact={(message, emoji) => void run(() => toggleMessageReaction(message.id, emoji))}
          onPin={message => void run(() => setMessagePin(message.id, !message.pinned))}
          onDelete={message => void (async () => {
            if (await confirmation.confirm({ title: 'Remove this message for everyone?', actionLabel: 'Remove for everyone', description: 'The message will be replaced by a deleted-message marker.', danger: true })) {
              await run(async () => {
                await deleteMessage(message.id);
                if (reply?.id === message.id) setReply(undefined);
                await refreshList();
              });
            }
          })()} />
      </div>
      {error && <p className="messages-error messages-composer-error" role="alert">{error}</p>}
      {!conversation.archived && <form className="messages-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
        {replyPreview && <div className="messages-composer-reply"><span><strong>Replying to {nicknames[replyPreview.senderId] || replyPreview.senderName}</strong><span>{replyPreview.deleted ? 'Message deleted.' : parseMessage(replyPreview.content).text}</span></span><button className="messages-icon-button" type="button" onClick={() => setReply(undefined)} aria-label="Cancel reply"><X size={16} /></button></div>}
        {image && <div className="messages-image-preview"><img src={image.preview} alt="Image ready to send" /><span>{image.file.name}</span><button type="button" className="messages-icon-button" disabled={busy} onClick={() => setImage(undefined)} aria-label="Remove attached image"><X size={16} /></button></div>}
        <div className="messages-compose-row">
          <input ref={imagePicker} type="file" hidden accept="image/jpeg,image/png,image/gif,image/webp" aria-label="Choose an image" onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try { validateChatImage(file); setImage({ file, preview: URL.createObjectURL(file) }); setError(''); }
            catch (failure) { setError(errorMessage(failure, 'Could not attach this image.')); }
          }} />
          <button type="button" className="messages-icon-button" disabled={busy} onClick={() => imagePicker.current?.click()} aria-label="Attach an image"><ImagePlus size={21} /></button>
          <ChatMentionInput composer={composer} draft={draft} setDraft={setDraft} channelId={conversation.channelId}
            userId={userId} group={group} disabled={busy} onSend={() => void send()} />
          <button type="submit" className="messages-send" disabled={(!draft.text.trim() && !image) || busy} aria-label="Send message"><Send size={18} /></button>
        </div>
      </form>}
    </section>
    {showInfo && <ConversationInfo conversation={conversation} messages={thread.history} pinned={thread.pinned}
      userId={userId} people={people} peopleError={peopleError} onChanged={async () => {
        setRosterRevision(current => current + 1);
        await Promise.all([refreshList(), thread.refresh()]);
      }}
      onClose={() => setShowInfo(false)} onOpenTask={onOpenTask} onOpenProject={onOpenProject} onShowPinned={showPinned} />}
    {selectedPin && <div className="messages-pin-preview" role="status"><span><strong>{selectedPin.senderName}</strong><span>{parseMessage(selectedPin.content).text}</span>{selectedPin.imagePath && <ConversationImage path={selectedPin.imagePath} thumbnail />}</span><button type="button" className="messages-icon-button" onClick={() => setSelectedPin(undefined)} aria-label="Close pinned message"><X size={18} /></button></div>}
    {confirmation.dialog}
  </div>;
}

function errorMessage(failure: unknown, fallback: string) {
  return failure instanceof Error ? failure.message : fallback;
}
