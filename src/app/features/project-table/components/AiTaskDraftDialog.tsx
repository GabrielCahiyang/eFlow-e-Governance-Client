import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { decomposeProposal } from '../../proposal-import';

/** Reuses the existing proposal engine; suggestions become work only after review. */
export function AiTaskDraftDialog({ open, onClose, projectTitle, onReview }: { open: boolean; onClose: () => void; projectTitle: string; onReview: (text: string) => void }) {
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !brief.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await decomposeProposal(brief.trim(), projectTitle);
      const titles = result.programs.flatMap(p => p.projects.flatMap(p => p.activities.flatMap(a => a.tasks.map(t => t.title.trim())))).filter(Boolean);
      if (!titles.length || titles.length > 100 || titles.some(t => t.length > 300)) throw new Error('The suggestions do not fit this task list. Refine your brief and try again.');
      onReview(titles.join('\n'));
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate suggestions. Your project has not changed.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="pt-small-dialog" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
    <DialogTitle>Decompose project with AI</DialogTitle>
    <DialogDescription>Describe the work for {projectTitle}. Review and edit the suggested task titles before adding them. Owners, dates and funding remain yours to set.</DialogDescription>
    <form className="pt-popover-form" onSubmit={generate}><label>Project brief<textarea rows={7} maxLength={12000} value={brief} onChange={e => setBrief(e.target.value)} disabled={busy} /></label>{error && <p role="alert">{error}</p>}<button className="pt-primary" disabled={busy || !brief.trim()}>{busy ? 'Preparing suggestions…' : 'Generate suggestions'}</button></form>
  </DialogContent></Dialog>;
}
