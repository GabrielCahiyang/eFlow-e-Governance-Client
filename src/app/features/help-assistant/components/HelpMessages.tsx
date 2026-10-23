import { BookOpen, Volume2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { HelpMessage, HelpReply } from '../types';

export function HelpMessages({ messages, disabled, speechReady, onListen }: { messages: HelpMessage[]; disabled: boolean; speechReady: boolean; onListen: (reply: HelpReply) => void }) {
  return <>{messages.map(message => <article key={message.id} className={`eflow-help-message eflow-help-message--${message.role}`}>
    <small>{message.role === 'user' ? 'You' : 'eFlow AI'}</small>
    {message.text.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {message.reply && <div className="eflow-help-message__tools">
      {!!message.reply.sources.length && <details><summary><BookOpen size={14}/>{message.reply.sources.length} {message.reply.sources.length === 1 ? 'source' : 'sources'}</summary>
        <ul>{message.reply.sources.map(source => <li key={source.id}><strong>{source.title}</strong><small> · {source.kind === 'guide' ? 'eFlow guide' : 'Visible record'}</small></li>)}</ul>
        <small>Checked {new Date(message.reply.observedAt * 1000).toLocaleTimeString()} · Guide {message.reply.knowledgeVersion}</small>
      </details>}
      <Button variant="ghost" size="sm" disabled={disabled || !speechReady} onClick={() => onListen(message.reply!)} aria-label="Read this answer aloud"><Volume2 size={16}/>Listen</Button>
    </div>}
  </article>)}</>;
}
