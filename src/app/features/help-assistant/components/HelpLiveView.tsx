import { AudioLines, ChevronDown, ChevronUp, CircleAlert, MessageSquare, Mic, MicOff, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/button';
import { HelpProcessingStatus } from './HelpProcessingStatus';
import type { useHelpConversation } from '../hooks/useHelpConversation';
import { HelpMessages } from './HelpMessages';
import { LIVE_TURN_SILENCE_MS } from '../services/voiceActivity';

type Conversation = ReturnType<typeof useHelpConversation>;
export function HelpLiveView({ conversation, context, onBack, microphoneInput }: { conversation: Conversation; context: string; onBack: () => void; microphoneInput?: ReactNode }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const latest = conversation.messages[conversation.messages.length - 1];
  const active = conversation.listening;
  return <section className={`eflow-live eflow-live--${conversation.stage}`} aria-label="eFlow Live conversation">
    <div className="eflow-live__top"><span><span className={active ? 'eflow-help-live-dot' : 'eflow-help-idle-dot'}/>{context}</span>
      <Button variant="ghost" onClick={onBack}><MessageSquare size={16}/>Back to chat</Button>
    </div>
    <div className="eflow-live__main">
      <p className="eflow-live__status" role="status">{conversation.stage === 'idle' && !active ? 'Conversation paused' : <HelpProcessingStatus stage={conversation.stage}/>}</p>
      <div className="eflow-live__orb" aria-hidden="true"><div className="eflow-live__glow"/><div className="eflow-live__waves">{Array.from({ length: 7 }, (_, index) => <i key={index} style={{ animationDelay: `${index * -.17}s` }}/>)}</div><AudioLines size={40}/></div>
      <div className="eflow-live__caption" aria-live="polite"><small>{conversation.partialTranscript ? 'You’re saying' : latest ? latest.role === 'user' ? 'You said' : 'eFlow AI' : 'Speak naturally'}</small>
        <p>{conversation.partialTranscript || latest?.text || 'Ask me about eFlow, or what needs attention in your project.'}</p>
      </div>
      {conversation.error && <p className="eflow-live__error" role="alert"><CircleAlert size={16}/>{conversation.error}</p>}
      {conversation.busy ? <Button variant="outline" className="eflow-live__interrupt" onClick={conversation.interrupt}>{active ? 'Interrupt and listen' : 'Stop reply'}</Button> : <p className="eflow-live__hint">{active ? `Pause for ${LIVE_TURN_SILENCE_MS / 1000} seconds to send your question.` : 'Resume whenever you’re ready.'}</p>}
    </div>
    <div className="eflow-live__bottom">
      {microphoneInput}
      <div className="eflow-live__controls">
        <Button variant="outline" size="icon" onClick={conversation.toggleMute} aria-label={conversation.muted ? 'Enable spoken replies' : 'Mute spoken replies'}>{conversation.muted ? <VolumeX/> : <Volume2/>}</Button>
        <Button className="eflow-live__pause" onClick={() => active ? conversation.pause() : void conversation.start()} aria-label={active ? 'Pause eFlow Live' : 'Resume eFlow Live'} title={active ? 'Pause microphone; the current reply continues' : 'Resume microphone'}>{active ? <><Pause size={18}/><Mic size={18}/></> : <><Play size={18}/><MicOff size={18}/></>}</Button>
        <Button variant="outline" onClick={onBack} aria-label="End eFlow Live">End</Button>
      </div>
      <Button variant="ghost" size="sm" aria-expanded={showTranscript} onClick={() => setShowTranscript(value => !value)}>{showTranscript ? <ChevronDown size={15}/> : <ChevronUp size={15}/>} {showTranscript ? 'Hide transcript' : 'Show transcript'}</Button>
      <small>AI can make mistakes. Voice takes longer while models warm up.</small>
    </div>
    {showTranscript && <div className="eflow-live__transcript" role="log" aria-label="Live transcript"><HelpMessages messages={conversation.messages} disabled={conversation.busy} speechReady onListen={reply => void conversation.replay(reply)}/></div>}
  </section>;
}
