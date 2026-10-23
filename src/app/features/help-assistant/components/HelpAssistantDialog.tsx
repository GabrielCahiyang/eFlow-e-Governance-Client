import { useEffect, useRef, useState } from 'react';
import { AudioLines, Check, CircleAlert, CornerDownLeft, LoaderCircle, Mic, Send, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../contexts/AuthContext';
import { helpRequest, loadHelpProjects } from '../services/helpApi';
import { useHelpConversation } from '../hooks/useHelpConversation';
import { useHelpDictation } from '../hooks/useHelpDictation';
import { HelpLiveView } from './HelpLiveView';
import { HelpMessages } from './HelpMessages';
import { HelpProcessingStatus } from './HelpProcessingStatus';
import { useMicrophoneDevices } from '../hooks/useMicrophoneDevices';
import { MicrophoneInput } from './MicrophoneInput';
import type { HelpProject } from '../types';
import '../helpAssistant.css';

export function HelpAssistantDialog({ onClose, returnFocusTarget }: { onClose: () => void; returnFocusTarget?: HTMLElement | null }) {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<HelpProject[]>([]), [projectId, setProjectId] = useState('');
  const [question, setQuestion] = useState(''), [loadError, setLoadError] = useState(''), [loading, setLoading] = useState(true);
  const [speechInstalled, setSpeechInstalled] = useState(false);
  const [live, setLive] = useState(false);
  const scope = `${userProfile?.id}:${userProfile?.org_id}:${userProfile?.role}`;
  const microphones = useMicrophoneDevices();
  const conversation = useHelpConversation(scope, projectId, microphones.deviceId);
  const draftInput = useRef<HTMLInputElement>(null);
  const dictationBase = useRef('');
  const dictation = useHelpDictation(`${scope}:${projectId}:${live}`, text => {
    setQuestion(`${dictationBase.current}${dictationBase.current && text ? ' ' : ''}${text}`.slice(0, 2000));
  }, microphones.deviceId);
  useEffect(() => { if (dictation.signal.label || conversation.signal.label) void microphones.refresh(); }, [dictation.signal.label, conversation.signal.label, microphones.refresh]);
  const changeMicrophone = (id: string) => { conversation.stop(); dictation.cancel(); microphones.setDeviceId(id); };
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setProjects([]); setProjectId(''); setSpeechInstalled(false); setQuestion(''); setLive(false);
    void Promise.allSettled([loadHelpProjects(controller.signal), helpRequest<{ speechInstalled: boolean }>('status', controller.signal)]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === 'fulfilled') {
        setProjects(results[0].value.projects);
        const currentProject = new URLSearchParams(window.location.search).get('project');
        if (results[0].value.projects.some(project => project.id === currentProject)) setProjectId(currentProject!);
      } else setLoadError('Project records could not be loaded. You can still ask about workflows.');
      if (results[1].status === 'fulfilled') setSpeechInstalled(results[1].value.speechInstalled);
      else setLoadError('eFlow AI is unavailable. Please try again shortly.');
      setLoading(false);
    });
    return () => controller.abort();
  }, [scope]);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' }); }, [conversation.messages, conversation.stage]);
  const submit = (text: string) => { if (!text.trim() || conversation.busy || dictation.busy) return; dictation.cancel(); setQuestion(''); void conversation.send(text); };
  const openLive = () => { dictation.cancel(); setLive(true); void conversation.start(); };
  const closeLive = () => { conversation.stop(); setLive(false); };
  const wasLive = useRef(false);
  useEffect(() => { if (wasLive.current && !live) draftInput.current?.focus(); wasLive.current = live; }, [live]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className={`eflow-help-assistant${live ? ' eflow-help-assistant--live' : ''}`} aria-describedby="eflow-assistant-description" onCloseAutoFocus={event => { if (returnFocusTarget?.isConnected) { event.preventDefault(); returnFocusTarget.focus({ preventScroll: true }); } }}>
      <DialogHeader className="eflow-help-assistant__heading">
        <span className="eflow-help-assistant__mark"><AudioLines size={24}/></span>
        <div className="eflow-help-assistant__heading-copy"><DialogTitle>{live ? 'eFlow Live' : 'Talk to eFlow AI'}</DialogTitle><DialogDescription id="eflow-assistant-description">{live ? 'Talk through your work, one question at a time.' : 'Guidance for your work, with the records behind each answer.'}</DialogDescription></div>
        {!live && <Button className="eflow-help-assistant__live-launch" variant="outline" disabled={loading || !speechInstalled || conversation.busy || dictation.busy} onClick={openLive}><AudioLines size={18}/>eFlow Live</Button>}
      </DialogHeader>
      {live ? <HelpLiveView conversation={conversation} context={projects.find(project => project.id === projectId)?.title || 'eFlow workflows'} onBack={closeLive} microphoneInput={<MicrophoneInput devices={microphones.devices} deviceId={microphones.deviceId} onChange={changeMicrophone} signal={conversation.signal} active={conversation.listening} stage={conversation.stage} disabled={conversation.busy}/>}/> : <>
      <div className="eflow-help-assistant__context">
        <label htmlFor="help-project">Ask about</label>
        <select id="help-project" value={projectId} disabled={loading || conversation.busy || dictation.busy} onChange={event => setProjectId(event.target.value)}>
          <option value="">eFlow workflows</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
        <span title="Answers use only records you can access. Other project work may be hidden."><Check size={14}/>Read only</span>
      </div>
      <div className="eflow-help-assistant__notice"><CircleAlert size={16}/><span>Lightweight AI can make mistakes. Verify important details in eFlow.</span></div>
      <div ref={transcript} className="eflow-help-assistant__transcript" role="log" aria-label="eFlow AI conversation" aria-live="polite">
        {!conversation.messages.length && <div className="eflow-help-assistant__welcome"><span className="eflow-help-assistant__welcome-icon"><Mic size={28}/></span><h3>What can I help you with?</h3><p>Ask how something works, or choose a project to check its recorded blockers.</p>
          <div>{['How do I request petty cash?', 'Why is this project waiting?', 'Who needs a follow-up?'].map(example => <button key={example} onClick={() => submit(example)} disabled={loading || conversation.busy || dictation.busy}>{example}<CornerDownLeft size={14}/></button>)}</div>
        </div>}
        <HelpMessages messages={conversation.messages} disabled={conversation.busy || dictation.busy} speechReady={speechInstalled} onListen={reply => void conversation.replay(reply)}/>
      </div>
      {(loadError || conversation.error || dictation.error) && <p className="eflow-help-assistant__error" role="alert"><CircleAlert size={16}/>{dictation.error || conversation.error || loadError}</p>}
      <div className="eflow-help-assistant__composer">
        <MicrophoneInput devices={microphones.devices} deviceId={microphones.deviceId} onChange={changeMicrophone} signal={dictation.signal} active={dictation.stage === 'recording'} disabled={conversation.busy || dictation.stage === 'transcribing'}/>
        <div className="eflow-help-assistant__voice"><span role="status">{conversation.busy || dictation.recognizing ? <LoaderCircle className="eflow-help-spin" size={16}/> : <span className={dictation.stage === 'recording' ? 'eflow-help-live-dot' : 'eflow-help-idle-dot'}/>} {loading ? 'Connecting to eFlow AI…' : dictation.stage === 'recording' ? dictation.recognizing ? 'Listening · adding words as you speak…' : 'Listening · press the mic to finish' : dictation.stage === 'transcribing' ? 'Finishing your dictated words…' : <HelpProcessingStatus stage={conversation.stage}/>}</span>
          {conversation.busy && <Button variant="ghost" size="sm" onClick={conversation.stop}><Square size={14}/>Stop response</Button>}
        </div>
        <form onSubmit={event => { event.preventDefault(); submit(question); }}><label className="sr-only" htmlFor="help-question">Ask eFlow AI</label><input ref={draftInput} id="help-question" value={question} maxLength={2000} placeholder="Ask about eFlow or this project…" onChange={event => { if (dictation.busy) dictation.cancel(); setQuestion(event.target.value); }} disabled={conversation.busy}/>
          <Button type="button" variant={dictation.stage === 'recording' ? 'default' : 'ghost'} size="icon" disabled={loading || !speechInstalled || conversation.busy || dictation.stage === 'transcribing'} onClick={() => { if (dictation.stage === 'recording') void dictation.finish().then(() => draftInput.current?.focus()); else { dictationBase.current = question.trim(); void dictation.start(); } }} aria-label={dictation.stage === 'recording' ? 'Finish dictation' : 'Dictate question'} aria-pressed={dictation.stage === 'recording'}>{dictation.stage === 'transcribing' ? <LoaderCircle className="eflow-help-spin" size={18}/> : <Mic size={18}/>}</Button>
          <Button type="submit" size="icon" disabled={loading || conversation.busy || dictation.busy || !question.trim()} aria-label="Send question"><Send size={18}/></Button></form>
        <div className="eflow-help-assistant__footer"><span>English · Read-only guidance</span><span>Dictate, edit, then send</span>
        </div>
        <small className="eflow-help-assistant__privacy">{speechInstalled ? 'Use the mic to fill your draft, or open eFlow Live for a hands-free conversation.' : 'Voice is being configured on the AI server. You can type your questions here.'}</small>
      </div>
      </>}
    </DialogContent>
  </Dialog>;
}
