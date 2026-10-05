import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { StatusPill } from '../../../components/ui/workspace';
import { professionalFields, type ProfessionalProfile, type ProfessionalValues, type PdsDocument } from '../types';
import { confirmProfessionalProfile, getMyPds, getPdsDownload, getPdsDraft, getProfessionalProfile, retryPds, updateProfessionalProfile, uploadPds } from '../services/professionalProfileService';
import '../../invitations/invitations.css';
import '../professionalProfile.css';

const labels = { skills: 'Skills', education: 'Education', trainings: 'Training', certifications: 'Certifications', work_experience: 'Work experience', specializations: 'Specializations' };
const emptyValues = (): ProfessionalValues => ({ skills: [], education: [], trainings: [], certifications: [], work_experience: [], specializations: [], competency_summary: '' });
export function ProfessionalProfilePanel({ userId }: { userId?: string }) {
  const { user } = useAuth(); const id = userId || user?.id; const own = id === user?.id;
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null); const [draft, setDraft] = useState<ProfessionalValues>(emptyValues);
  const [documents, setDocuments] = useState<PdsDocument[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState(false);
  const refresh = useCallback(async () => {
    if (!id) return;
    const { profile: latest } = await getProfessionalProfile(id); setProfile(latest);
    if (own) setDocuments((await getMyPds()).documents);
  }, [id, own]);
  useEffect(() => { void refresh().catch(reason => setError(reason.message)); }, [refresh]);
  useEffect(() => { if (!documents.some(pdsDocument => ['pending', 'processing'].includes(pdsDocument.processing_status))) return; const timer = window.setInterval(() => { void refresh().catch(() => {}); }, 5000); return () => window.clearInterval(timer); }, [documents, refresh]);
  async function perform(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await refresh(); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); } }
  return <section className="eflow-professional-panel" aria-label="Professional profile"><header className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">Professional profile</h2><StatusPill label={profile?.confirmed_by_user ? 'Confirmed' : 'Awaiting review'} tone={profile?.confirmed_by_user ? 'positive' : 'warning'} /></header>
    <p className="eflow-invite-help">Keep only work-relevant skills, experience, and qualifications. Private PDS details stay out of your team summary.</p>
    {editing ? <form onSubmit={event => { event.preventDefault(); void perform(async () => { await updateProfessionalProfile(draft); setEditing(false); }); }} className="eflow-professional-form">
      {professionalFields.map(field => <label key={field}>{labels[field]}<textarea rows={3} value={draft[field].join('\n')} placeholder="One entry per line" onChange={event => setDraft(current => ({ ...current, [field]: event.target.value.split('\n') }))} /></label>)}
      <label>Professional summary<textarea rows={3} maxLength={1500} value={draft.competency_summary} onChange={event => setDraft(current => ({ ...current, competency_summary: event.target.value }))} /></label>
      <div className="flex gap-4"><button type="submit" className="eflow-primary-button" disabled={busy}>Save changes</button><button type="button" className="eflow-text-button" onClick={() => setEditing(false)}>Cancel</button></div>
    </form> : <><div className="eflow-professional-sections">{professionalFields.map(field => <div key={field}><h3>{labels[field]}</h3>{profile?.[field]?.length ? <ul>{profile[field].map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p className="text-sm text-neutral-400">Not added yet</p>}</div>)}</div>{profile?.competency_summary && <p className="text-sm leading-6">{profile.competency_summary}</p>}
      {own && <div className="flex flex-wrap gap-4"><button type="button" className="eflow-text-button" disabled={busy} onClick={() => { setDraft(profile ? Object.fromEntries([...professionalFields.map(field => [field, profile[field]]), ['competency_summary', profile.competency_summary]]) as ProfessionalValues : emptyValues()); setEditing(true); }}>Edit profile</button><button type="button" className="eflow-primary-button" disabled={busy || !profile || profile.confirmed_by_user} onClick={() => void perform(confirmProfessionalProfile)}>Confirm profile</button></div>}
    </>}
    {own && <section className="eflow-pds-list" aria-label="Your private PDS documents"><h3>Personal Data Sheet <span className="text-xs text-neutral-500">Private · optional</span></h3><label className="eflow-text-button">Upload or replace PDS<input aria-label="Upload your PDS PDF" disabled={busy} type="file" accept="application/pdf,.pdf" onChange={event => { const file = event.target.files?.[0]; if (file) void perform(() => uploadPds(file)); event.target.value = ''; }} /></label>{documents.map(pdsDocument => <div key={pdsDocument.id} className="eflow-pds-item"><div><strong>{pdsDocument.original_filename}</strong><p>{pdsDocument.processing_status === 'completed' ? 'Processed — review your profile above' : pdsDocument.processing_status}</p>{pdsDocument.processing_error && <p>{pdsDocument.processing_error}</p>}</div><div>{pdsDocument.processing_status === 'completed' && <button className="eflow-text-button" disabled={busy} onClick={() => void perform(async () => { setDraft((await getPdsDraft(pdsDocument.id)).draft); setEditing(true); })}>Review extracted draft</button>}{pdsDocument.processing_status === 'failed' && <button className="eflow-text-button" disabled={busy} onClick={() => void perform(() => retryPds(pdsDocument.id))}>Retry processing</button>}<button className="eflow-text-button" disabled={busy} onClick={() => void perform(async () => { const { url } = await getPdsDownload(pdsDocument.id); const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click(); })}>View private PDF</button></div></div>)}</section>}
    {error && <p role="alert" className="eflow-form-error">{error}</p>}
  </section>;
}
