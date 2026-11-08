import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Info, Phone, Pin, Send, Video, X } from 'lucide-react';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { deleteMessage, sendMessageWithMentions } from '../../../services/chatService';
import { initiateCall } from '../../../services/callService';
import { useConversation } from '../hooks/useConversation';
import { parseMessage } from '../services/chatMessageCodec';
import { setMessagePin, toggleMessageReaction, type Conversation, type Message } from '../services/messagesWorkspace';
import { ConversationAvatar } from './ChatChannelList';
import { ConversationInfo } from './ConversationInfo';
import { MessageHistory } from './MessageHistory';
import { useMessages } from './MessagesContext';
import { removeChatImage, uploadChatImage, validateChatImage } from '../services/chatImages';
import { ConversationImage } from './ConversationImage';

export function ActiveChatPanel({ conversation, userId, userName, onBack, onOpenTask, onOpenProject }: {
  conversation: Conversation; userId?: string; userName?: string;
  onBack: () => void; onOpenTask: (id: string) => void; onOpenProject: (id: string) => void;
}) {
  const { refresh: refreshList, outgoingCall, setOutgoingCall } = useMessages();
  const thread = useConversation(conversation.channelId, conversation.unread, refreshList);
  const [showInfo, setShowInfo] = useState(false);
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<{ file: File; preview: string }>();
  const [reply, setReply] = useState<Message>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedPin, setSelectedPin] = useState<Message>();
  const confirmation = useConfirmation();
  const historyRef = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const nearBottom = useRef(true);
  const latest = thread.history[thread.history.length - 1];
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.preview); }, [image]);

  useEffect(() => {
    const history = historyRef.current;
    if (history && nearBottom.current) history.scrollTop = history.scrollHeight;
  }, [latest?.id]);
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
    if (!userId || sending.current || (!draft.trim() && !image)) return;
    sending.current = true;
    setBusy(true);
    setError('');
    let uploaded: string | undefined;
    try {
      const text = draft.trim();
      const content = reply ? JSON.stringify({ text, replyToName: reply.senderName, replyToText: parseMessage(reply.content).text }) : text;
      if (image) uploaded = await uploadChatImage(conversation.channelId, userId, image.file);
      await sendMessageWithMentions(conversation.channelId, userId, userName || 'Someone', content, uploaded);
      setImage(undefined);
      setDraft('');
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
    } else setSelectedPin(message);
  }

  return <div className="messages-active-layout" data-show-info={showInfo || undefined}>
    <section className="messages-thread" aria-label={'Conversation with ' + conversation.name}>
      <header className="messages-thread-header">
        <button type="button" className="messages-icon-button messages-back" aria-label="Back to conversations" onClick={onBack}><ArrowLeft size={20} /></button>
        <ConversationAvatar conversation={conversation} />
        <div className="messages-thread-identity">
          <h2>{conversation.name}</h2>
          <p>{conversation.projectTitle || (conversation.taskId ? 'Task chat' : conversation.projectId ? 'Project chat' : conversation.orgId ? 'Office channel' : 'Direct message')}</p>
        </div>
        <div className="messages-thread-tools">
          {conversation.channelType === 'direct' && conversation.otherUserId && <>
            <button type="button" className="messages-icon-button" aria-label="Start audio call" onClick={() => void startCall('audio')}><Phone size={18} /></button>
            <button type="button" className="messages-icon-button" aria-label="Start video call" onClick={() => void startCall('video')}><Video size={19} /></button>
          </>}
          <button type="button" className="messages-icon-button" aria-label="Chat info" aria-expanded={showInfo} onClick={() => setShowInfo(value => !value)}><Info size={20} /></button>
        </div>
      </header>
      {thread.pinned[0] && <button type="button" className="messages-pinned-bar" onClick={() => showPinned(thread.pinned[0])}><Pin size={15} /><span>{parseMessage(thread.pinned[0].content).text || 'Shared image'}</span><small>{thread.pinned.length} pinned</small></button>}
      <div className="messages-history eflow-scroll-region" ref={historyRef}
        onScroll={event => {
          const el = event.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
          if (nearBottom.current) void thread.markRead();
        }}>
        {thread.loading ? <p role="status" className="messages-list-state">Loading messages…</p> : null}
        {thread.error && <p role="alert" className="messages-error">{thread.error} <button type="button" onClick={() => void thread.refresh()}>Retry</button></p>}
        {!thread.loading && thread.hasOlder && thread.history.length > 0 && <button type="button" className="messages-earlier" disabled={thread.loadingOlder} onClick={async () => {
          const el = historyRef.current;
          const height = el?.scrollHeight || 0;
          nearBottom.current = false;
          await thread.loadOlder();
          requestAnimationFrame(() => { if (el) el.scrollTop += el.scrollHeight - height; });
        }}>{thread.loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
        {!thread.loading && !thread.error && thread.history.length === 0 && <div className="messages-empty-thread"><ConversationAvatar conversation={conversation} /><h3>Start the conversation</h3><p>{conversation.taskId ? 'Use this chat to coordinate work on this task.' : 'Send the first message to get things started.'}</p></div>}
        <MessageHistory messages={thread.history} userId={userId}
          onReply={message => { setReply(message); composer.current?.focus(); }}
          onReact={(message, emoji) => void run(() => toggleMessageReaction(message.id, emoji))}
          onPin={message => void run(() => setMessagePin(message.id, !message.pinned))}
          onDelete={message => void (async () => {
            if (await confirmation.confirm({ title: 'Remove this message?', actionLabel: 'Remove message', description: 'This removes the message for everyone in the conversation.', danger: true })) {
              await run(async () => { await deleteMessage(message.id); if (message.imagePath) await removeChatImage(message.imagePath); });
            }
          })()} />
      </div>
      {error && <p className="messages-error messages-composer-error" role="alert">{error}</p>}
      <form className="messages-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
        {reply && <div className="messages-composer-reply"><span><strong>Replying to {reply.senderName}</strong><span>{parseMessage(reply.content).text}</span></span><button className="messages-icon-button" type="button" onClick={() => setReply(undefined)} aria-label="Cancel reply"><X size={16} /></button></div>}
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
          <textarea ref={composer} aria-label="Message" placeholder="Write a message…" value={draft} rows={1} maxLength={1000} disabled={busy}
            onChange={event => setDraft(event.target.value)} onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
            }} />
          <button type="submit" className="messages-send" disabled={(!draft.trim() && !image) || busy} aria-label="Send message"><Send size={18} /></button>
        </div>
      </form>
    </section>
    {showInfo && <ConversationInfo conversation={conversation} messages={thread.history} pinned={thread.pinned}
      onClose={() => setShowInfo(false)} onOpenTask={onOpenTask} onOpenProject={onOpenProject} onShowPinned={showPinned} />}
    {selectedPin && <div className="messages-pin-preview" role="status"><span><strong>{selectedPin.senderName}</strong><span>{parseMessage(selectedPin.content).text}</span>{selectedPin.imagePath && <ConversationImage path={selectedPin.imagePath} thumbnail />}</span><button type="button" className="messages-icon-button" onClick={() => setSelectedPin(undefined)} aria-label="Close pinned message"><X size={18} /></button></div>}
    {confirmation.dialog}
  </div>;
}

function errorMessage(failure: unknown, fallback: string) {
  return failure instanceof Error ? failure.message : fallback;
}
