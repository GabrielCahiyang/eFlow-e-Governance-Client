import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { Button } from '../../../components/ui/button';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import {
  professionalFields,
  type ProfessionalProfile,
  type ProfessionalValues,
  type PdsDocument,
} from '../types';
import {
  confirmProfessionalProfile,
  getMyPds,
  getPdsDownload,
  getPdsDraft,
  getProfessionalProfile,
  retryPds,
  updateProfessionalProfile,
  uploadPds,
} from '../services/professionalProfileService';
import { SkillTagSelector } from '../../../components/ui/SkillTagSelector';
import { useSkillTags } from '../../../shared/skillTags';
import '../../invitations/invitations.css';
import '../professionalProfile.css';

const labels = {
  skills: 'Skills',
  education: 'Education',
  trainings: 'Training',
  certifications: 'Certifications',
  work_experience: 'Work experience',
  specializations: 'Specializations',
};

const emptyValues = (): ProfessionalValues => ({
  skills: [],
  education: [],
  trainings: [],
  certifications: [],
  work_experience: [],
  specializations: [],
  competency_summary: '',
});

function sanitizeDraft(draft: ProfessionalValues): ProfessionalValues {
  return {
    skills: draft.skills.map((item) => item.trim()).filter(Boolean),
    education: draft.education.map((item) => item.trim()).filter(Boolean),
    trainings: draft.trainings.map((item) => item.trim()).filter(Boolean),
    certifications: draft.certifications.map((item) => item.trim()).filter(Boolean),
    work_experience: draft.work_experience.map((item) => item.trim()).filter(Boolean),
    specializations: draft.specializations.map((item) => item.trim()).filter(Boolean),
    competency_summary: draft.competency_summary.trim(),
  };
}

export function ProfessionalProfilePanel({
  userId,
  projectRequestId,
  availableSkills,
}: {
  userId?: string;
  projectRequestId?: string;
  availableSkills?: readonly string[];
}) {
  const confirmation = useConfirmation();
  const [notice, setNotice] = useState('');
  const [pollError, setPollError] = useState('');
  const [uploadFieldError, setUploadFieldError] = useState('');
  const [uploadTipActive, setUploadTipActive] = useState(false);
  const uploadAnchorRef = useRef<HTMLLabelElement | null>(null);
  const uploadTooltipId = useId();
  const { user } = useAuth();
  const id = userId || user?.id;
  const own = id === user?.id;
  const { activeLabels: liveSkillTags, loading: loadingSkillTags } = useSkillTags(
    !(availableSkills && availableSkills.length > 0),
  );
  const skillOptions = availableSkills && availableSkills.length > 0 ? availableSkills : liveSkillTags;
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [draft, setDraft] = useState<ProfessionalValues>(emptyValues);
  const [fromExtraction, setFromExtraction] = useState(false);
  const [documents, setDocuments] = useState<PdsDocument[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [baseline, setBaseline] = useState<ProfessionalValues>(emptyValues);
  const dirty = useMemo(
    () => JSON.stringify(sanitizeDraft(draft)) !== JSON.stringify(sanitizeDraft(baseline)),
    [baseline, draft],
  );
  const guard = useExplicitDraft(
    'Professional profile',
    editing && dirty,
    busy,
    () => {
      setEditing(false);
      setFromExtraction(false);
    },
  );
  const requestVersion = useRef(0);

  const values = () =>
    profile
      ? (Object.fromEntries([
          ...professionalFields.map((field) => [field, profile[field]]),
          ['competency_summary', profile.competency_summary],
        ]) as ProfessionalValues)
      : emptyValues();

  const refresh = useCallback(async () => {
    if (!id) return;
    const version = ++requestVersion.current;
    const { profile: latest } = await getProfessionalProfile(id);
    if (version !== requestVersion.current) return;
    setProfile(latest);
    setError('');
    if (own) {
      const result = await getMyPds();
      if (version === requestVersion.current) setDocuments(result.documents || []);
    }
  }, [id, own]);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setDocuments([]);
    setEditing(false);
    setFromExtraction(false);
    setNotice('');
    setPollError('');
    setUploadFieldError('');
    setUploadTipActive(false);
    setLoading(true);
    void refresh()
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      ++requestVersion.current;
    };
  }, [refresh]);

  useEffect(() => {
    if (!documents.some((pdsDocument) => ['pending', 'processing'].includes(pdsDocument.processing_status))) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh()
        .then(() => setPollError(''))
        .catch(() =>
          setPollError(
            'Processing status could not refresh. Your document is retained; refresh its status.',
          ),
        );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [documents, refresh]);

  async function perform(action: () => Promise<unknown>, receipt = '') {
    if (guard.pendingRef.current) return;
    guard.pendingRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    let succeeded = false;
    try {
      await action();
      succeeded = true;
      if (receipt) setNotice(receipt);
      await refresh();
    } catch (reason) {
      setError(
        succeeded && receipt
          ? `${receipt} Refresh failed; verify the current status without repeating the action. ${(reason as Error).message}`
          : (reason as Error).message,
      );
    } finally {
      guard.pendingRef.current = false;
      setBusy(false);
    }
  }

  const confirmProfile = async () => {
    if (busy || guard.pendingRef.current || !own || !profile || profile.confirmed_by_user) return;
    if (
      !(await confirmation.confirm({
        title: 'Confirm professional summary?',
        description:
          'Confirm the saved work-relevant summary for authorized staffing suggestions. Your private PDS remains private. Editing later resets this confirmation.',
        actionLabel: 'Confirm summary',
        impact: (
          <p>
            {professionalFields.reduce((n, field) => n + profile[field].length, 0)} qualification entries ·{' '}
            {profile.competency_summary || 'No summary text'}
          </p>
        ),
      }))
    ) {
      return;
    }
    await perform(async () => {
      const result = await confirmProfessionalProfile();
      setProfile(result.profile);
    }, 'Professional summary confirmed.');
  };

  const saveDraft = (andConfirm = false) => {
    const cleaned = sanitizeDraft(draft);
    if (!dirty && !andConfirm) {
      setError('No changes to save yet.');
      return;
    }
    void perform(
      async () => {
        const result = await updateProfessionalProfile(cleaned);
        let latest = result.profile;
        if (andConfirm && own) {
          const confirmed = await confirmProfessionalProfile();
          latest = confirmed.profile;
        }
        setProfile(latest);
        guard.markClean();
        setEditing(false);
        setFromExtraction(false);
      },
      andConfirm
        ? 'Profile changes saved and confirmed.'
        : 'Profile changes saved. Review and confirm the updated summary.',
    );
  };

  const upload = (file: File) => {
    setUploadFieldError('');
    setUploadTipActive(false);
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf || file.size > 10485760 || file.size === 0) {
      setError('');
      setUploadFieldError('Choose a nonempty PDF up to 10 MB.');
      setUploadTipActive(true);
      return;
    }
    void perform(
      () => uploadPds(file, undefined, projectRequestId),
      'Private PDS uploaded. Extraction is queued; review the extracted draft before saving your summary.',
    );
  };

  if (loading) return <p role="status" className="text-sm text-[var(--eflow-text-muted)]">Loading authorized professional summary…</p>;
  if (error && !profile && !editing) {
    return (
      <FeedbackState tone="error" title="Professional summary not loaded" onRetry={() => void perform(refresh)}>
        {error}
      </FeedbackState>
    );
  }

  const statusTone = profile?.confirmed_by_user
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-800';
  const statusLabel = profile?.confirmed_by_user
    ? 'Confirmed'
    : profile
      ? 'Awaiting review'
      : 'No confirmed summary';

  const saveDisabled = busy || !dirty;
  const saveTooltip = busy
    ? 'Saving your profile changes…'
    : !dirty
      ? 'Edit at least one field before saving changes.'
      : '';
  const saveAndConfirmTooltip = busy
    ? 'Saving and confirming your profile…'
    : !dirty
      ? 'Edit at least one field before saving and confirming.'
      : '';
  const confirmDisabled = busy || !profile || profile.confirmed_by_user;
  const confirmTooltip = busy
    ? 'Updating your profile…'
    : !profile
      ? 'Save your professional profile before confirming it.'
      : profile.confirmed_by_user
        ? 'Your current professional summary is already confirmed.'
        : '';

  return (
    <section className="eflow-professional-panel" aria-label="Professional profile">
      {confirmation.dialog}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--eflow-text)]">Professional profile</h2>
        <span
          role="status"
          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${statusTone}`}
        >
          {statusLabel}
        </span>
      </header>
      <p className="text-xs leading-relaxed text-[var(--eflow-text-muted)]">
        Keep only work-relevant skills, experience, and qualifications. Private PDS details stay out of your team summary.
      </p>
      {!profile && !editing && (
        <p className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3.5 py-2.5 text-xs text-[var(--eflow-text-secondary)]">
          No confirmed professional summary is available. This does not indicate whether a private PDS exists.
        </p>
      )}
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveDraft(false);
          }}
          className="eflow-professional-form"
        >
          <p className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3 py-2 text-xs text-[var(--eflow-text-secondary)]">
            Review extracted text carefully. Save your work-relevant changes, then confirm the saved summary separately. Saving resets earlier confirmation.
          </p>
          <fieldset disabled={busy}>
            {professionalFields.map((field) =>
              field === 'skills' ? (
                <div
                  key={field}
                  className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3"
                >
                  <SkillTagSelector
                    availableTags={skillOptions}
                    loading={loadingSkillTags}
                    selected={draft.skills}
                    disabled={busy}
                    title="Skills"
                    description="Tap skill tags to choose your skills."
                    onChange={(next) => setDraft((current) => ({ ...current, skills: next }))}
                  />
                </div>
              ) : (
                <label key={field}>
                  <span>{labels[field]}</span>
                  <BoundedTextarea
                    aria-label={labels[field]}
                    rows={3}
                    maxLength={4000}
                    value={draft[field].join('\n')}
                    placeholder="One entry per line"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [field]: event.target.value.split('\n') }))
                    }
                  />
                </label>
              ),
            )}
            <label>
              <span>Professional summary</span>
              <BoundedTextarea
                aria-label="Professional summary"
                rows={3}
                maxLength={1500}
                value={draft.competency_summary}
                placeholder="Brief summary of core work strengths and domain focus"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, competency_summary: event.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <WorkspaceTooltip content={saveTooltip} disabled={!saveDisabled || !saveTooltip}>
                <span className="inline-flex">
                  <Button type="submit" size="sm" disabled={saveDisabled}>
                    Save changes
                  </Button>
                </span>
              </WorkspaceTooltip>
              {own && !fromExtraction && (
                <WorkspaceTooltip content={saveAndConfirmTooltip} disabled={!saveDisabled || !saveAndConfirmTooltip}>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={saveDisabled}
                      onClick={() => saveDraft(true)}
                    >
                      Save &amp; confirm
                    </Button>
                  </span>
                </WorkspaceTooltip>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void requestNavigation(() => {
                    setEditing(false);
                    setFromExtraction(false);
                  })
                }
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <div className="eflow-professional-sections">
            {professionalFields.map((field) => (
              <div key={field} className="eflow-professional-section-card">
                <h3>{labels[field]}</h3>
                {profile?.[field]?.length ? (
                  <ul>
                    {profile[field].map((entry, index) => (
                      <li key={index}>{entry}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--eflow-text-muted)]">Not added yet</p>
                )}
              </div>
            ))}
          </div>
          {profile?.competency_summary && (
            <div className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-3.5 text-sm leading-6 text-[var(--eflow-text)]">
              {profile.competency_summary}
            </div>
          )}
          {own && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const current = values();
                  setDraft(current);
                  setBaseline(current);
                  setFromExtraction(false);
                  setEditing(true);
                }}
              >
                Edit profile
              </Button>
              <WorkspaceTooltip content={confirmTooltip} disabled={!confirmDisabled || !confirmTooltip}>
                <span className="inline-flex">
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmDisabled}
                    onClick={() => void confirmProfile()}
                  >
                    Confirm profile
                  </Button>
                </span>
              </WorkspaceTooltip>
            </div>
          )}
        </>
      )}
      {own && (
        <section className="eflow-pds-list" aria-label="Your private PDS documents">
          <h3>
            Personal Data Sheet{' '}
            <span className="text-xs font-normal text-[var(--eflow-text-muted)]">Private · optional</span>
          </h3>
          <label
            ref={uploadAnchorRef}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              uploadFieldError
                ? 'border-red-400 bg-red-50/40 text-red-700'
                : 'border-[var(--eflow-border)] bg-[var(--eflow-surface)] text-[var(--eflow-text)] hover:bg-[var(--eflow-subtle)]'
            }`}
            aria-describedby={uploadFieldError ? uploadTooltipId : undefined}
            onMouseEnter={() => {
              if (uploadFieldError) setUploadTipActive(true);
            }}
            onMouseLeave={() => setUploadTipActive(false)}
            onFocus={() => {
              if (uploadFieldError) setUploadTipActive(true);
            }}
            onBlur={() => setUploadTipActive(false)}
          >
            <span>Upload or replace PDS</span>
            <input
              aria-label="Upload your PDS PDF"
              disabled={busy}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = '';
              }}
            />
          </label>
          <FieldValidationTooltip
            id={uploadTooltipId}
            anchorRef={uploadAnchorRef}
            message={uploadFieldError}
            open={Boolean(uploadFieldError) && uploadTipActive}
            tone="error"
          />
          {uploadFieldError && (
            <p role="alert" className="text-xs font-medium text-[var(--eflow-negative-text)]">
              {uploadFieldError}
            </p>
          )}
          {documents.map((pdsDocument) => (
            <div key={pdsDocument.id} className="eflow-pds-item">
              <div>
                <strong>{pdsDocument.original_filename}</strong>
                <p role="status">
                  {pdsDocument.processing_status === 'completed'
                    ? 'Extracted draft ready — review before saving and confirming'
                    : pdsDocument.processing_status === 'pending'
                      ? 'Queued for extraction'
                      : pdsDocument.processing_status === 'processing'
                        ? 'Extracting work-relevant qualifications…'
                        : 'Extraction failed — retry processing'}
                </p>
                {pdsDocument.processing_error && <p>{pdsDocument.processing_error}</p>}
              </div>
              <div>
                {pdsDocument.processing_status === 'completed' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        setDraft((await getPdsDraft(pdsDocument.id)).draft);
                        setBaseline(values());
                        setFromExtraction(true);
                        setEditing(true);
                      })
                    }
                  >
                    Review extracted draft
                  </Button>
                )}
                {pdsDocument.processing_status === 'failed' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void perform(
                        () => retryPds(pdsDocument.id),
                        'Processing retry queued. Review the extracted draft when it completes.',
                      )
                    }
                  >
                    Retry processing
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const { url } = await getPdsDownload(pdsDocument.id);
                      const link = document.createElement('a');
                      link.href = url;
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      link.click();
                    })
                  }
                >
                  View private PDF
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {notice}
        </p>
      )}
      {pollError && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {pollError}{' '}
          <button
            type="button"
            className="font-medium underline"
            disabled={busy}
            onClick={() => void perform(refresh)}
          >
            Refresh processing status
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="eflow-form-error">
          {error}
        </p>
      )}
    </section>
  );
}
