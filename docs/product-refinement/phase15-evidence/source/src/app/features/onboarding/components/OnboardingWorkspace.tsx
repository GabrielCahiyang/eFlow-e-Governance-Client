import { requestNavigation } from '../../../shared/navigationGuard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, HelpCircle, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { WorkspaceIllustration } from '../../../components/ui/WorkspaceIllustration';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { getRoleLabel } from '../../../shared/roles';
import { ProfessionalProfilePanel } from '../../professional-profile';
import { readOnboarding, saveOnboarding } from '../services/onboardingService';
import { onboardingChecklist } from '../checklist';
import type { ChecklistStep, OnboardingRecord } from '../types';
import '../onboarding.css';

export function OnboardingHelpButton() { return <button type="button" className="eflow-onboarding-help" aria-label="Help and Getting Started" title="Help and Getting Started" onClick={() => window.dispatchEvent(new Event('eflow-open-getting-started'))}><HelpCircle size={19} /></button>; }

export function OnboardingWorkspace({ onNavigate }: { onNavigate: (section: string, page: string) => void }) {
  const { user, userProfile } = useAuth(); const { orgs } = useOrgs();
  const [record, setRecord] = useState<OnboardingRecord>(); const [welcome, setWelcome] = useState(false); const [help, setHelp] = useState(false); const [profile, setProfile] = useState(false);
  const [step, setStep] = useState('welcome'); const [interests, setInterests] = useState<string[]>(['Work on assigned tasks']); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const active = useRef(true); const role = userProfile?.role || 'member'; const items = onboardingChecklist(role);
  const office = orgs.find(item => item.id === userProfile?.org_id)?.name || 'your Office';
  const completed = record?.state?.completed_steps || ['account'];
  useEffect(() => {
    active.current = true;
    if (!user?.id || role === 'admin') return;
    void readOnboarding().then(value => { if (!active.current) return; setRecord(value); setInterests(value.state.interests || ['Work on assigned tasks']); setStep(['welcome', 'interests', 'ready'].includes(value.current_step || '') ? value.current_step! : 'welcome'); setWelcome(value.status === 'not_started' || (value.status === 'in_progress' && !value.state.completed_steps?.includes('welcome'))); }).catch(reason => { if (active.current) setError((reason as Error).message); });
    return () => { active.current = false; };
  }, [user?.id, role]);
  useEffect(() => { const open = () => setHelp(true); window.addEventListener('eflow-open-getting-started', open); return () => window.removeEventListener('eflow-open-getting-started', open); }, []);
  const save = useCallback(async (values: Parameters<typeof saveOnboarding>[0]) => { setBusy(true); setError(''); try { const next = await saveOnboarding(values); setRecord(next); return next; } catch (reason) { setError((reason as Error).message); throw reason; } finally { setBusy(false); } }, []);
  async function advance() {
    const next = step === 'welcome' ? 'interests' : step === 'interests' ? 'ready' : 'workspace';
    await save({ status: 'in_progress', current_step: next, interests, ...(next === 'workspace' ? { completed_steps: [...new Set([...completed, 'account', 'welcome'])] } : {}) });
    if (next === 'workspace') { setWelcome(false); window.dispatchEvent(new Event('eflow-first-run-finished')); } else setStep(next);
  }
  async function mark(id: string, checked: boolean) {
    const next = checked ? [...new Set([...completed, id])] : completed.filter(item => item !== id);
    await save({ status: items.every(item => next.includes(item.id)) ? 'completed' : 'in_progress', completed_steps: next });
  }
  function openItem(item: ChecklistStep) {
    setHelp(false);
    if (item.action === 'profile') setProfile(true);
    else if (item.action === 'notifications') { document.querySelector<HTMLButtonElement>("[data-tour-id='communications'] button[title$='notifications']")?.click(); }
    else if (item.section && item.page) { onNavigate(item.section, item.page); if (item.action === 'tour') window.setTimeout(() => window.dispatchEvent(new Event('eflow-start-context-tour')), 500); }
  }
  if (role === 'admin') return null;
  const content = <><h2>Getting Started</h2><p>A few small steps to feel at home in eFlow.</p><div className="eflow-checklist">{items.map(item => <div key={item.id}><label><input type="checkbox" aria-label={`Mark ${item.label} complete`} checked={completed.includes(item.id)} disabled={busy || item.id === 'account'} onChange={event => { void mark(item.id, event.target.checked).catch(() => {}); }} /><span>{item.label}</span></label>{(item.section || item.action) && <button type="button" aria-label={`Open ${item.label}`} onClick={() => openItem(item)}><ArrowRight size={16} /></button>}</div>)}</div>{record?.status === 'completed' && <p className="eflow-checklist-finished"><Check size={17} /> You’re all set. This checklist is always available from Help.</p>}</>;
  return <>
    {record && record.status !== 'completed' && !welcome && <aside className="eflow-getting-started-banner" aria-label="Getting Started"><div><strong>Make yourself at home</strong><span>{items.filter(item => completed.includes(item.id)).length} of {items.length} steps complete</span></div><button onClick={() => setHelp(true)}>Getting Started <ArrowRight size={14} /></button></aside>}
    <Dialog open={welcome} onOpenChange={value => { if (!value && !busy) { void save({ status: 'dismissed' }).then(() => { setWelcome(false); window.dispatchEvent(new Event('eflow-first-run-finished')); }).catch(() => {}); } }}><DialogContent className="eflow-onboarding-dialog"><section><span className="eflow-onboarding-wordmark">eFlow.</span><p className="eflow-eyebrow">{step === 'welcome' ? 'A NEW WAY TO WORK TOGETHER' : step === 'interests' ? 'MAKE IT YOURS' : 'YOU’RE READY'}</p><DialogTitle>{step === 'welcome' ? `Welcome to eFlow, ${(userProfile?.full_name || 'teammate').split(' ')[0]}.` : step === 'interests' ? 'What brings you here?' : 'Your workspace is ready.'}</DialogTitle><DialogDescription>{step === 'welcome' ? `You’re joining ${office} as ${getRoleLabel(role)}.` : step === 'interests' ? 'Choose what matters to your work. These choices won’t change your access.' : 'Start small. Your team, tasks, and guidance are one click away.'}</DialogDescription>
      {step === 'interests' && <div className="eflow-onboarding-options">{(role === 'head' ? ['Build my Office team', 'Assign and review work', 'Track Office reports'] : role === 'accounting_staff' ? ['Work on assigned tasks', 'Cash and cheque releases', 'Liquidation and settlement', 'Accounting journal'] : ['Work on assigned tasks', 'Track deadlines', 'Submit project evidence', 'Collaborate with teammates']).map(option => <label key={option}><input type="checkbox" checked={interests.includes(option)} onChange={event => setInterests(current => event.target.checked ? [...current, option] : current.filter(item => item !== option))} />{option}</label>)}</div>}
      {step === 'ready' && <div className="eflow-onboarding-ready"><Check size={23} /><span>{office}<small>{getRoleLabel(role)} workspace</small></span></div>}
      <footer><button className="eflow-text-button" disabled={busy} onClick={() => { void save({ status: 'dismissed' }).then(() => { setWelcome(false); window.dispatchEvent(new Event('eflow-first-run-finished')); }).catch(() => {}); }}>Skip for now</button><button className="eflow-primary-button" disabled={busy} onClick={() => { void advance().catch(() => {}); }}>{busy ? 'Saving…' : step === 'ready' ? 'Enter your workspace' : 'Continue'} <ArrowRight size={16} /></button></footer>{error && <p className="eflow-form-error" role="alert">{error}</p>}
    </section><WorkspaceIllustration /></DialogContent></Dialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="eflow-checklist-dialog"><DialogTitle>Help & Getting Started</DialogTitle><DialogDescription>Your role-aware guide to working with your Office.</DialogDescription>{content}<button className="eflow-text-button" onClick={() => { setHelp(false); setProfile(true); }}>Review your professional profile</button>{error && <p role="alert" className="eflow-form-error">{error}</p>}</DialogContent></Dialog>
    <Dialog open={profile} onOpenChange={next=>{if(next)setProfile(true);else void requestNavigation(()=>setProfile(false));}}><DialogContent className="eflow-member-panel"><DialogTitle>Your professional profile</DialogTitle><DialogDescription>Review and confirm your work-relevant background.</DialogDescription><ProfessionalProfilePanel /></DialogContent></Dialog>
  </>;
}
