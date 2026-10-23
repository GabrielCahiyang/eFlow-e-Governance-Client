import { lazy, Suspense, useRef, useState } from 'react';
import { AudioLines, BookOpen, Compass, HelpCircle, ListChecks } from 'lucide-react';
import { ActionMenu, type WorkspaceAction } from '../../../components/ui/workspace';
import { Button } from '../../../components/ui/button';
import { useGuidedTour } from './GuidedTourProvider';
import '../guidedTourPresentation.css';

const HelpAssistantDialog = lazy(() => import('../../help-assistant').then(module => ({ default: module.HelpAssistantDialog })));
type HelpChoice = 'getting-started' | 'page' | 'system' | 'assistant';
/** One help surface; existing providers remain the launch/progress owners. */
export function WorkspaceHelpMenu({ open, onOpenChange, role, returnFocusTarget }: {
  open: boolean;
  onOpenChange: (open: boolean, trigger?: HTMLElement | null) => void;
  role: string;
  returnFocusTarget?: HTMLElement | null;
}) {
  const { isTourActive, startPageTour, startSystemTour } = useGuidedTour();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const pending = useRef<HelpChoice | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choice = (id: HelpChoice, label: string, icon: WorkspaceAction['icon']): WorkspaceAction => ({
    id, label, icon, disabled: isTourActive, disabledReason: 'Finish or exit the active tour first.', onSelect: () => { pending.current = id; },
  });
  return <><ActionMenu contentClassName="eflow-help-menu" open={open} onOpenChange={next => onOpenChange(next, next ? trigger.current : undefined)}
    trigger={<Button ref={trigger} variant="ghost" aria-label="Open help" className="eflow-topbar__help-trigger" data-tour-id="workspace-help"><HelpCircle aria-hidden="true" size={18}/><span>Help</span></Button>}
    actions={[
      ...(role !== 'admin' ? [choice('getting-started', 'Getting started', <ListChecks aria-hidden="true"/>)] : []),
      choice('page', 'Guide for this page', <BookOpen aria-hidden="true"/>),
      choice('system', 'Tour of eFlow', <Compass aria-hidden="true"/>),
      choice('assistant', 'Talk to eFlow AI', <AudioLines aria-hidden="true"/>),
    ]}
    onCloseAutoFocus={event => {
      const selected = pending.current;
      pending.current = null;
      // Restore the actual opener before another provider captures launch focus.
      const target = returnFocusTarget || trigger.current;
      if (target?.isConnected) { event.preventDefault(); target.focus(); }
      if (!selected || isTourActive) return;
      if (selected === 'assistant') setAssistantOpen(true);
      else if (selected === 'getting-started') window.dispatchEvent(new Event('eflow-open-getting-started'));
      else if (selected === 'page') startPageTour();
      else startSystemTour();
    }} />{assistantOpen && <Suspense fallback={null}><HelpAssistantDialog returnFocusTarget={returnFocusTarget || trigger.current} onClose={() => setAssistantOpen(false)}/></Suspense>}</>;
}
