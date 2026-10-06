import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { StatusPill } from '../../../components/ui/workspace';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { professionalFields, type ProfessionalProfile, type ProfessionalValues, type PdsDocument } from '../types';
import { confirmProfessionalProfile, getMyPds, getPdsDownload, getPdsDraft, getProfessionalProfile, retryPds, updateProfessionalProfile, uploadPds } from '../services/professionalProfileService';
import '../../invitations/invitations.css';
import '../professionalProfile.css';

const labels = { skills: 'Skills', education: 'Education', trainings: 'Training', certifications: 'Certifications', work_experience: 'Work experience', specializations: 'Specializations' };
const emptyValues = (): ProfessionalValues => ({ skills: [], education: [], trainings: [], certifications: [], work_experience: [], specializations: [], competency_summary: '' });
export function ProfessionalProfilePanel({ userId }: { userId?: string }) {
  const confirmation = useConfirmation();
  const [notice, setNotice] = useState(''), [pollError, setPollError] = useState('');
  const { user } = useAuth(); const id = userId || user?.id; const own = id === user?.id;
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null); const [draft, setDraft] = useState<ProfessionalValues>(emptyValues);
  const [documents, setDocuments] = useState<PdsDocument[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [baseline, setBaseline] = useState<ProfessionalValues>(emptyValues);
  const guard = useExplicitDraft('Professional profile', editing && JSON.stringify(draft) !== JSON.stringify(baseline), busy, () => setEditing(false));
  const requestVersion = useRef(0);
  const values = () => profile ? Object.fromEntries([...professionalFields.map(field => [field, profile[field]]), ['competency_summary', profile.competency_summary]]) as ProfessionalValues : emptyValues();
  const refresh = useCallback(async () => {
    if (!id) return;
    const version = ++requestVersion.current;
    const { profile: latest } = await getProfessionalProfile(id);
    if (version !== requestVersion.current) return;
    setProfile(latest); setError('');
    if (own) { const result = await getMyPds(); if (version === requestVersion.current) setDocuments(result.documents || []); }
  }, [id, own]);
  useEffect(() => { let active = true; setProfile(null); setDocuments([]); setEditing(false); setNotice(''); setPollError(''); setLoading(true); void refresh().catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; ++requestVersion.current; }; }, [refresh]);
  useEffect(() => { if (!documents.some(pdsDocument => ['pending', 'processing'].includes(pdsDocument.processing_status))) return; const timer = window.setInterval(() => { void refresh().then(()=>setPollError('')).catch(()=>setPollError('Processing status could not refresh. Your document is retained; refresh its status.')); }, 5000); return () => window.clearInterval(timer); }, [documents, refresh]);
  async function perform(action: () => Promise<unknown>, receipt = '') {
    if (guard.pendingRef.current) return; guard.pendingRef.current = true; setBusy(true); setError(''); setNotice('');
    let succeeded = false;
    try { await action(); succeeded = true; if (receipt) setNotice(receipt); await refresh(); }
    catch (reason) { setError(succeeded && receipt ? `${receipt} Refresh failed; verify the current status without repeating the action. ${(reason as Error).message}` : (reason as Error).message); }
    finally { guard.pendingRef.current = false; setBusy(false); }
  }
  const confirmProfile = async () => {
    if (busy || guard.pendingRef.current || !own || !profile || profile.confirmed_by_user) return;
    if (!await confirmation.confirm({ title: 'Confirm professional summary?', description: 'Confirm the saved work-relevant summary for authorized staffing suggestions. Your private PDS remains private. Editing later resets this confirmation.', actionLabel: 'Confirm summary', impact: <p>{professionalFields.reduce((n,field)=>n+profile[field].length,0)} qualification entries · {profile.competency_summary || 'No summary text'}</p> })) return;
    await perform(async()=>{const result=await confirmProfessionalProfile();setProfile(result.profile);}, 'Professional summary confirmed.');
  };
  const upload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10485760 || file.size === 0) { setError('Choose a nonempty PDF up to 10 MB.'); return; }
    void perform(()=>uploadPds(file), 'Private PDS uploaded. Extraction is queued; review the extracted draft before saving your summary.');
  };
  if (loading) return <p role="status">Loading authorized professional summary…</p>;
  if (error && !profile && !editing) return <FeedbackState tone="error" title="Professional summary not loaded" onRetry={() => void perform(refresh)}>{error}</FeedbackState>;
  return <section className="eflow-professional-panel" aria-label="Professional profile">{confirmation.dialog}<header className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">Professional profile</h2><StatusPill label={profile?.confirmed_by_user ? 'Confirmed' : profile ? 'Awaiting review' : 'No confirmed summary'} tone={profile?.confirmed_by_user ? 'positive' : 'warning'} /></header>
    <p className="eflow-invite-help">Keep only work-relevant skills, experience, and qualifications. Private PDS details stay out of your team summary.</p>
    {!profile && !editing && <p>No confirmed professional summary is available. This does not indicate whether a private PDS exists.</p>}
    {editing ? <form onSubmit={event => { event.preventDefault(); void perform(async () => { const result=await updateProfessionalProfile(draft);setProfile(result.profile); guard.markClean(); setEditing(false); }, 'Profile changes saved. Review and confirm the updated summary.'); }} className="eflow-professional-form"><p className="eflow-invite-help">Review extracted text carefully. Save your work-relevant changes, then confirm the saved summary separately. Saving resets earlier confirmation.</p><fieldset disabled={busy}>
      {professionalFields.map(field => <label key={field}>{labels[field]}<textarea rows={3} value={draft[field].join('\n')} placeholder="One entry per line" onChange={event => setDraft(current => ({ ...current, [field]: event.target.value.split('\n') }))} /></label>)}
      <label>Professional summary<textarea rows={3} maxLength={1500} value={draft.competency_summary} onChange={event => setDraft(current => ({ ...current, competency_summary: event.target.value }))} /></label>
      <div className="flex gap-4"><button type="submit" className="eflow-primary-button" disabled={busy}>Save changes</button><button type="button" className="eflow-text-button" onClick={() => void requestNavigation(() => setEditing(false))}>Cancel</button></div>
    </fieldset></form> : <><div className="eflow-professional-sections">{professionalFields.map(field => <div key={field}><h3>{labels[field]}</h3>{profile?.[field]?.length ? <ul>{profile[field].map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p className="text-sm text-neutral-400">Not added yet</p>}</div>)}</div>{profile?.competency_summary && <p className="text-sm leading-6">{profile.competency_summary}</p>}
      {own && <div className="flex flex-wrap gap-4"><button type="button" className="eflow-text-button" disabled={busy} onClick={() => { setDraft(values()); setBaseline(values()); setEditing(true); }}>Edit profile</button><button type="button" className="eflow-primary-button" disabled={busy || !profile || profile.confirmed_by_user} onClick={() => void confirmProfile()}>Confirm profile</button></div>}
    </>}
    {own && <section className="eflow-pds-list" aria-label="Your private PDS documents"><h3>Personal Data Sheet <span className="text-xs text-neutral-500">Private · optional</span></h3><label className="eflow-text-button">Upload or replace PDS<input aria-label="Upload your PDS PDF" disabled={busy} type="file" accept="application/pdf,.pdf" onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ''; }} /></label>{documents.map(pdsDocument => <div key={pdsDocument.id} className="eflow-pds-item"><div><strong>{pdsDocument.original_filename}</strong><p role="status">{pdsDocument.processing_status === 'completed' ? 'Extracted draft ready — review before saving and confirming' : pdsDocument.processing_status === 'pending' ? 'Queued for extraction' : pdsDocument.processing_status === 'processing' ? 'Extracting work-relevant qualifications…' : 'Extraction failed — retry processing'}</p>{pdsDocument.processing_error && <p>{pdsDocument.processing_error}</p>}</div><div>{pdsDocument.processing_status === 'completed' && <button className="eflow-text-button" disabled={busy} onClick={() => void perform(async () => { setDraft((await getPdsDraft(pdsDocument.id)).draft); setBaseline(values()); setEditing(true); })}>Review extracted draft</button>}{pdsDocument.processing_status === 'failed' && <button className="eflow-text-button" disabled={busy} onClick={() => void perform(() => retryPds(pdsDocument.id), 'Processing retry queued. Review the extracted draft when it completes.')}>Retry processing</button>}<button className="eflow-text-button" disabled={busy} onClick={() => void perform(async () => { const { url } = await getPdsDownload(pdsDocument.id); const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click(); })}>View private PDF</button></div></div>)}</section>}
    {notice && <p role="status">{notice}</p>}{pollError && <p role="alert">{pollError}<button className="eflow-text-button" disabled={busy} onClick={()=>void perform(refresh)}>Refresh processing status</button></p>}
    {error && <p role="alert" className="eflow-form-error">{error}</p>}
  </section>;
}
