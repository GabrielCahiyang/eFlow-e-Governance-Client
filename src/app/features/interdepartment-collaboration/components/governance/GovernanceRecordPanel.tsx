import { EmptyState } from '../../../../components/ui/EmptyState';
import { BoundedTextarea, BoundedTextInput } from '../../../../components/ui/BoundedInput';
import { DateInput } from '../../../../components/ui/DateInput';
import { WorkspaceTooltip } from '../../../../components/ui/workspace/WorkspaceTooltip';
import { getPhilippineCalendarDate, historicalDateError } from '../../../../shared/calendarDates';
import { formatManilaDateTime } from '../../../../shared/calendarDisplay';
import { attachmentError, EVIDENCE_ACCEPT } from '../../../../shared/fileValidation';
import { INPUT_LIMITS } from '../../../../shared/inputLimits';
import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import * as React from "react";
import { Download, ExternalLink, FileCheck2, Upload } from "lucide-react";
import type { Organization, UserProfile } from "../../../../types";
import type { GovernanceRecord, GovernanceSignoff } from "../../types";

export function GovernanceRecordPanel({
  records,
  signoffs,
  organizations,
  profiles,
  actingOrgId,
  busy,
  onSaveRecord,
  onOpenMinutes,
  onDownloadPacket,
  savedReceipt = 0,
}: {
  records: GovernanceRecord[];
  signoffs: GovernanceSignoff[];
  organizations: Organization[];
  profiles: UserProfile[];
  actingOrgId?: string;
  busy: boolean;
  savedReceipt?: number;
  onSaveRecord: (input: {
    resolutionNumber: string;
    meetingDate: string;
    endorsement: string;
    minutesFile?: File;
  }) => Promise<void>;
  onOpenMinutes: (path: string) => Promise<void>;
  onDownloadPacket: () => void;
}) {
  const current = records.find((item) => item.organizationId === actingOrgId);
  const [resolution, setResolution] = React.useState("");
  const [meetingDate, setMeetingDate] = React.useState("");
  const [endorsement, setEndorsement] = React.useState("");
  const [file, setFile] = React.useState<File>();
  const [validationError, setValidationError] = React.useState('');
  const [resolutionTouched, setResolutionTouched] = React.useState(false);
  const [meetingDateTouched, setMeetingDateTouched] = React.useState(false);
  const [meetingDateInvalidText, setMeetingDateInvalidText] = React.useState(false);
  const resolutionId = React.useId();
  const meetingDateId = React.useId();
  const endorsementId = React.useId();

  const rawResolutionError = !resolution.trim()
    ? 'Resolution number is required.'
    : resolution.length > INPUT_LIMITS.SHORT_TAG
      ? `Use a resolution number up to ${INPUT_LIMITS.SHORT_TAG} characters.`
      : '';
  const rawMeetingDateError = meetingDateInvalidText
    ? 'Enter a valid meeting date in MM/DD/YYYY format.'
    : historicalDateError(meetingDate, 'Meeting date');
  const rawEndorsementError =
    endorsement.length > INPUT_LIMITS.SUMMARY
      ? `Use an endorsement note up to ${INPUT_LIMITS.SUMMARY.toLocaleString('en-US')} characters.`
      : '';
  const fileIssue = attachmentError(file ? [file] : [], { maxCount: 1 });
  const visibleResolutionError = resolutionTouched ? rawResolutionError : '';
  const visibleMeetingDateError =
    meetingDateTouched || meetingDateInvalidText || Boolean(meetingDate)
      ? rawMeetingDateError
      : '';
  const saveBlockedReason = busy
    ? ''
    : rawResolutionError || rawMeetingDateError || rawEndorsementError || fileIssue || '';

  const saveRecord = () => {
    setResolutionTouched(true);
    setMeetingDateTouched(true);
    const issue = rawResolutionError || rawMeetingDateError || rawEndorsementError || fileIssue;
    if (issue) {
      if (fileIssue) setValidationError(fileIssue);
      return;
    }
    setValidationError('');
    void onSaveRecord({
      resolutionNumber: resolution.trim(),
      meetingDate,
      endorsement: endorsement.trim(),
      minutesFile: file,
    });
  };

  const canonical = React.useMemo(
    () => ({
      resolution: current?.resolutionNumber || "",
      meetingDate: current?.meetingDate || "",
      endorsement: current?.endorsement || "",
    }),
    [current],
  );
  const [baseline, setBaseline] = React.useState(canonical);
  const dirty =
    Boolean(file) ||
    JSON.stringify({ resolution, meetingDate, endorsement }) !==
      JSON.stringify(baseline);
  const guard = useExplicitDraft(
    "Formal governance record",
    Boolean(actingOrgId) && dirty,
    busy,
    () => {
      setResolution(canonical.resolution);
      setMeetingDate(canonical.meetingDate);
      setEndorsement(canonical.endorsement);
      setFile(undefined);
      setResolutionTouched(false);
      setMeetingDateTouched(false);
      setMeetingDateInvalidText(false);
      setValidationError('');
      setBaseline(canonical);
    },
    actingOrgId,
  );
  const scope = React.useRef(actingOrgId),
    previousReceipt = React.useRef(savedReceipt),
    initialized = React.useRef(false);
  React.useEffect(() => {
    if (previousReceipt.current !== savedReceipt) {
      previousReceipt.current = savedReceipt;
      setBaseline({ resolution, meetingDate, endorsement });
      setFile(undefined);
      setResolutionTouched(false);
      setMeetingDateTouched(false);
      setMeetingDateInvalidText(false);
      guard.markClean();
    }
  }, [savedReceipt]);
  React.useEffect(() => {
    if (!initialized.current || !dirty || scope.current !== actingOrgId) {
      initialized.current = true;
      scope.current = actingOrgId;
      setResolution(canonical.resolution);
      setMeetingDate(canonical.meetingDate);
      setEndorsement(canonical.endorsement);
      setFile(undefined);
      setResolutionTouched(false);
      setMeetingDateTouched(false);
      setMeetingDateInvalidText(false);
      setValidationError('');
      setBaseline(canonical);
    }
  }, [canonical, actingOrgId]);
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <FileCheck2 size={15} /> Decisions, resolutions, and minutes
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">
            The immutable revision, named approvals, Board record, evidence
            index, and audit hashes form the final decision packet.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadPacket}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[10px] text-neutral-700 hover:bg-neutral-50"
        >
          <Download size={12} /> Decision packet
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          {records.length ? (
            records.map((record) => (
              <article
                key={record.id}
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-medium">
                    {
                      organizations.find(
                        (item) => item.id === record.organizationId,
                      )?.name
                    }
                  </div>
                  {record.minutesFilePath && (
                    <button
                      type="button"
                      onClick={() =>
                        void onOpenMinutes(record.minutesFilePath!)
                      }
                      className="inline-flex items-center gap-1 text-[9px] text-blue-600"
                    >
                      <ExternalLink size={10} /> Open minutes
                    </button>
                  )}
                </div>
                <div className="mt-1 text-[9px] text-neutral-500">
                  Resolution {record.resolutionNumber || "not recorded"} ·
                  Meeting {record.meetingDate || "not recorded"}
                </div>
                {record.endorsement && (
                  <p className="mt-2 text-[9px] leading-relaxed text-neutral-600">
                    {record.endorsement}
                  </p>
                )}
              </article>
            ))
          ) : (
            <EmptyState illustration="files" size="compact" title="No Board resolution or meeting minutes have been recorded yet."/>
          )}
        </div>
        <div className="space-y-2">
          {signoffs.slice(0, 8).map((signoff) => (
            <div
              key={signoff.id}
              className="flex items-start gap-2 rounded-xl border border-neutral-100 px-3 py-2"
            >
              <span
                className={`mt-1 h-2 w-2 rounded-full ${signoff.decision === "approved" ? "bg-emerald-500" : signoff.decision === "recused" ? "bg-violet-500" : "bg-amber-500"}`}
              />
              <div>
                <div className="text-[10px] font-medium text-neutral-800">
                  {profiles.find((item) => item.id === signoff.userId)
                    ?.full_name || "Decision maker"}{" "}
                  ·{" "}
                  <span className="capitalize">
                    {signoff.decision.replace("_", " ")}
                  </span>
                </div>
                <div className="text-[8.5px] text-neutral-400">
                  {
                    organizations.find(
                      (item) => item.id === signoff.organizationId,
                    )?.name
                  }{" "}
                  · {formatManilaDateTime(signoff.createdAt, "—")}
                </div>
                {signoff.reason && (
                  <div className="mt-1 text-[9px] text-neutral-600">
                    {signoff.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {actingOrgId && (
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="text-[10px] font-medium text-primary">
            Record your organization’s formal action
          </div>
          <div className="mt-2 grid items-start gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor={resolutionId} className="mb-1 block text-[10px] font-medium text-neutral-700">
                Resolution number
                <span className="text-[var(--eflow-negative-text)]" aria-hidden="true"> *</span>
              </label>
              <BoundedTextInput
                id={resolutionId}
                maxLength={INPUT_LIMITS.SHORT_TAG}
                value={resolution}
                aria-required
                error={visibleResolutionError || undefined}
                onBlur={() => setResolutionTouched(true)}
                onChange={(event) => {
                  setResolution(event.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="Resolution number"
                className="h-9 w-full rounded-lg border border-primary/25 bg-white px-3 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label htmlFor={meetingDateId} className="mb-1 block text-[10px] font-medium text-neutral-700">
                Meeting date
                <span className="text-[var(--eflow-negative-text)]" aria-hidden="true"> *</span>
              </label>
              <DateInput
                id={meetingDateId}
                max={getPhilippineCalendarDate()}
                value={meetingDate}
                aria-required
                hasError={Boolean(visibleMeetingDateError)}
                errorMessage={visibleMeetingDateError || undefined}
                onInvalidTextChange={setMeetingDateInvalidText}
                onBlur={() => setMeetingDateTouched(true)}
                onChange={(event) => {
                  setMeetingDate(event.target.value);
                  if (validationError) setValidationError('');
                }}
                className="h-9 rounded-lg border border-primary/25 bg-white px-3 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              {visibleMeetingDateError && (
                <span className="mt-1 block text-[11px] font-medium text-[var(--eflow-negative-text)]">
                  {visibleMeetingDateError}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2">
            <label htmlFor={endorsementId} className="mb-1 block text-[10px] font-medium text-neutral-700">
              Endorsement or decision note
            </label>
            <BoundedTextarea
              id={endorsementId}
              maxLength={INPUT_LIMITS.SUMMARY}
              value={endorsement}
              error={rawEndorsementError || undefined}
              onChange={(event) => {
                setEndorsement(event.target.value);
                if (validationError) setValidationError('');
              }}
              rows={2}
              placeholder="Endorsement or decision note"
              className="w-full resize-none rounded-lg border border-primary/25 bg-white px-3 py-2 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 py-2 text-[10px] text-primary transition hover:bg-primary/5">
              <Upload size={11} />{" "}
              {file?.name || current?.minutesFileName || "Attach signed minutes"}
              <input
                type="file"
                accept={EVIDENCE_ACCEPT}
                className="hidden"
                onChange={event => {
                  const chosen = event.target.files?.[0];
                  const issue = attachmentError(chosen ? [chosen] : [], { maxCount: 1 });
                  setValidationError(issue);
                  if (!issue) setFile(chosen);
                  event.target.value = '';
                }}
              />
            </label>
            <WorkspaceTooltip content={saveBlockedReason} disabled={!saveBlockedReason}>
              <span className="inline-flex">
                <button
                  type="button"
                  disabled={busy || Boolean(rawResolutionError || rawMeetingDateError || rawEndorsementError || fileIssue)}
                  onClick={saveRecord}
                  className="rounded-lg bg-primary px-3 py-2 text-[10px] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
                >
                  Save formal record
                </button>
              </span>
            </WorkspaceTooltip>
          </div>
          {validationError && <p role="alert" className="mt-2 text-xs text-destructive">{validationError}</p>}
        </div>
      )}
    </section>
  );
}
