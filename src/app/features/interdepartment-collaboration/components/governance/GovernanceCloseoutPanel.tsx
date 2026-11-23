import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { BoundedTextarea, BoundedTextInput } from "../../../../components/ui/BoundedInput";
import { DateInput } from "../../../../components/ui/DateInput";
import { WorkspaceTooltip } from "../../../../components/ui/workspace/WorkspaceTooltip";
import { getPhilippineCalendarDate, historicalDateError } from "../../../../shared/calendarDates";
import { INPUT_LIMITS } from "../../../../shared/inputLimits";
import * as React from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { Organization } from "../../../../types";
import type {
  CollaborationParticipant,
  ProposalCloseout,
  ProposalCloseoutDecision,
} from "../../types";

export function GovernanceCloseoutPanel({
  closeout,
  decisions,
  participants,
  organizations,
  allTasksApproved,
  canManage,
  decisionOrgId,
  busy,
  onRequest,
  onDecide,
  onComplete,
  onArchive,
  savedReceipt = 0,
}: {
  closeout: ProposalCloseout | null;
  decisions: ProposalCloseoutDecision[];
  participants: CollaborationParticipant[];
  organizations: Organization[];
  allTasksApproved: boolean;
  canManage: boolean;
  decisionOrgId?: string;
  busy: boolean;
  savedReceipt?: number;
  onRequest: (note: string) => Promise<void>;
  onDecide: (
    decision: "approved" | "changes_requested" | "declined",
    reason: string,
    resolutionNumber: string,
    meetingDate: string,
  ) => Promise<void>;
  onComplete: (note: string) => Promise<void>;
  onArchive: (reason: string) => Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [resolution, setResolution] = React.useState("");
  const [meetingDate, setMeetingDate] = React.useState("");
  const [meetingDateInvalidText, setMeetingDateInvalidText] = React.useState(false);
  const [reasonTouched, setReasonTouched] = React.useState(false);
  const requestNoteId = React.useId();
  const resolutionId = React.useId();
  const meetingDateId = React.useId();
  const decisionReasonId = React.useId();
  const [baseline, setBaseline] = React.useState({
    note: "",
    reason: "",
    resolution: "",
    meetingDate: "",
  });
  const guard = useExplicitDraft(
    "Governance closeout",
    JSON.stringify({ note, reason, resolution, meetingDate }) !==
      JSON.stringify(baseline),
    busy,
    () => {
      setNote(baseline.note);
      setReason(baseline.reason);
      setResolution(baseline.resolution);
      setMeetingDate(baseline.meetingDate);
      setMeetingDateInvalidText(false);
      setReasonTouched(false);
    },
    decisionOrgId,
  );
  const previousReceipt = React.useRef(savedReceipt);
  React.useEffect(() => {
    if (previousReceipt.current !== savedReceipt) {
      previousReceipt.current = savedReceipt;
      setBaseline({ note, reason, resolution, meetingDate });
      setMeetingDateInvalidText(false);
      setReasonTouched(false);
      guard.markClean();
    }
  }, [savedReceipt]);
  const governance = participants.filter(
    (item) => item.participationRole === "governance",
  );
  const status = closeout?.status || "draft";
  const canRequest =
    canManage &&
    allTasksApproved &&
    ["draft", "changes_requested"].includes(status);
  const meetingDateError = meetingDateInvalidText
    ? "Enter a valid meeting date in MM/DD/YYYY format."
    : historicalDateError(meetingDate, "Meeting date", false);
  const correctionReasonMissing = !reason.trim()
    ? "Enter an endorsement or required correction reason first."
    : "";
  const requestCorrectionTip = busy
    ? ""
    : meetingDateError ||
      correctionReasonMissing ||
      "Returns closeout to the proposal owner with required corrections.";
  const declineTip = busy
    ? ""
    : meetingDateError ||
      (!reason.trim()
        ? "Enter a reason before declining closeout."
        : "Formally declines governance closeout and notifies the proposal owner.");
  const approveTip = busy ? "" : meetingDateError;
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 to-slate-800 p-5 text-white">
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          <ShieldCheck size={16} /> Final governance closeout
        </div>
        <p className="mt-1 text-[10px] text-slate-300">
          Tasks finish the work. Closeout verifies the complete proposal record
          before completion and archive.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] capitalize">
            {status.replace("_", " ")}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] ${allTasksApproved ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-200"}`}
          >
            {allTasksApproved ? "All tasks approved" : "Delivery still active"}
          </span>
        </div>
      </div>
      <div className="p-5">
        {governance.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {governance.map((participant) => {
              const decision = decisions.find(
                (item) => item.organizationId === participant.orgId,
              );
              return (
                <div
                  key={participant.orgId}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="text-[10px] font-medium text-neutral-900">
                    {
                      organizations.find(
                        (item) => item.id === participant.orgId,
                      )?.name
                    }
                  </div>
                  <div
                    className={`mt-1 text-[9px] capitalize ${decision?.decision === "approved" ? "text-emerald-600" : decision ? "text-amber-600" : "text-neutral-400"}`}
                  >
                    {decision?.decision.replace("_", " ") || "Pending closeout"}
                  </div>
                  {decision?.resolutionNumber && (
                    <div className="mt-1 text-[8.5px] text-neutral-500">
                      Resolution {decision.resolutionNumber}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canRequest && (
          <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <label htmlFor={requestNoteId} className="mb-1.5 block text-[10px] font-medium text-primary">
              Request final verification
            </label>
            <BoundedTextarea
              id={requestNoteId}
              maxLength={INPUT_LIMITS.COMMENT}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Closeout note and final deliverables summary"
              className="w-full resize-none rounded-lg border border-primary/25 bg-white px-3 py-2 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRequest(note.trim())}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[10px] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}{" "}
              {governance.length
                ? "Send closeout to governance"
                : "Prepare completion"}
            </button>
          </div>
        )}

        {decisionOrgId && ["pending", "changes_requested"].includes(status) && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-[10px] font-medium text-amber-900">
              Your final closeout decision
            </div>
            <div className="mt-2 grid items-start gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor={resolutionId} className="mb-1 block text-[10px] font-medium text-amber-900">
                  Board resolution number (optional)
                </label>
                <BoundedTextInput
                  id={resolutionId}
                  maxLength={INPUT_LIMITS.CODE}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  placeholder="Board resolution number (optional)"
                  className="h-9 w-full rounded-lg border border-amber-200 bg-white px-3 text-[10px] outline-none"
                />
              </div>
              <div>
                <label htmlFor={meetingDateId} className="mb-1 block text-[10px] font-medium text-amber-900">
                  Meeting date (optional)
                </label>
                <DateInput
                  id={meetingDateId}
                  aria-label="Meeting date"
                  max={getPhilippineCalendarDate()}
                  value={meetingDate}
                  hasError={Boolean(meetingDateError)}
                  errorMessage={meetingDateError || undefined}
                  onInvalidTextChange={setMeetingDateInvalidText}
                  onChange={(event) => setMeetingDate(event.target.value)}
                  className="h-9 rounded-lg border border-amber-200 bg-white px-3 text-[10px] outline-none"
                />
                {meetingDateError && (
                  <span className="mt-1 block text-[11px] font-medium text-[var(--eflow-negative-text)]">
                    {meetingDateError}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2">
              <label htmlFor={decisionReasonId} className="mb-1 block text-[10px] font-medium text-amber-900">
                Endorsement or required correction
              </label>
              <BoundedTextarea
                id={decisionReasonId}
                maxLength={INPUT_LIMITS.REASON}
                value={reason}
                onBlur={() => setReasonTouched(true)}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Endorsement or required correction"
                hint={!reason.trim() ? "Optional for approval; required to request correction or decline." : undefined}
                error={
                  reasonTouched && !reason.trim()
                    ? "Enter a reason before requesting corrections or declining closeout."
                    : undefined
                }
                className="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-[10px] outline-none"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <WorkspaceTooltip content={approveTip} disabled={!approveTip}>
                <span className="inline-flex">
                  <button
                    type="button"
                    disabled={busy || Boolean(meetingDateError)}
                    onClick={() =>
                      void onDecide("approved", reason.trim(), resolution.trim(), meetingDate)
                    }
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] text-white disabled:opacity-40"
                  >
                    Approve closeout
                  </button>
                </span>
              </WorkspaceTooltip>
              <WorkspaceTooltip content={requestCorrectionTip} disabled={!requestCorrectionTip}>
                <span className="inline-flex">
                  <button
                    type="button"
                    disabled={busy || !reason.trim() || Boolean(meetingDateError)}
                    onClick={() => {
                      setReasonTouched(true);
                      if (!reason.trim() || meetingDateError) return;
                      void onDecide(
                        "changes_requested",
                        reason.trim(),
                        resolution.trim(),
                        meetingDate,
                      );
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[10px] text-amber-800 disabled:opacity-40"
                  >
                    Request correction
                  </button>
                </span>
              </WorkspaceTooltip>
              <WorkspaceTooltip content={declineTip} disabled={!declineTip}>
                <span className="inline-flex">
                  <button
                    type="button"
                    disabled={busy || !reason.trim() || Boolean(meetingDateError)}
                    onClick={() => {
                      setReasonTouched(true);
                      if (!reason.trim() || meetingDateError) return;
                      void onDecide("declined", reason.trim(), resolution.trim(), meetingDate);
                    }}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[10px] text-red-700 disabled:opacity-40"
                  >
                    Decline
                  </button>
                </span>
              </WorkspaceTooltip>
            </div>
          </div>
        )}

        {canManage && status === "approved" && (
          <ActionBox
            icon={<ClipboardCheck size={14} />}
            title="Governance verification complete"
            description="Complete every operational project together in one audited transaction."
            button="Mark proposal completed"
            busy={busy}
            value={note}
            onChange={setNote}
            onSubmit={() => onComplete(note)}
          />
        )}
        {canManage && status === "completed" && (
          <ActionBox
            icon={<Archive size={14} />}
            title="Proposal is completed"
            description="Archiving removes every linked task from active Task Boards while retaining the proposal, decisions, evidence, and audit record."
            button="Archive proposal delivery"
            busy={busy}
            value={reason}
            onChange={setReason}
            required
            onSubmit={() => onArchive(reason)}
          />
        )}
        {status === "archived" && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 size={18} />
            <div>
              <div className="text-[11px] font-medium">
                Governance record archived
              </div>
              <div className="text-[9px]">
                Operational projects and tasks are removed from active
                workspaces. The audit trail remains available.
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ActionBox({
  icon,
  title,
  description,
  button,
  busy,
  value,
  onChange,
  required = false,
  onSubmit,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  button: string;
  busy: boolean;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  onSubmit: () => Promise<void>;
}) {
  const [touched, setTouched] = React.useState(false);
  const inputId = React.useId();
  const rawError =
    required && !value.trim()
      ? "Archive reason is required before archiving proposal delivery."
      : "";
  const visibleError = touched ? rawError : "";
  const buttonTooltip = busy
    ? ""
    : rawError ||
      (required
        ? "Archives this proposal and removes all linked tasks from active Task Boards while preserving audit records."
        : "");
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium text-emerald-900">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-[9px] text-emerald-700">{description}</p>
      <div className="mt-2">
        <label htmlFor={inputId} className="mb-1 block text-[10px] font-medium text-emerald-900">
          {required ? "Archive reason" : "Completion note (optional)"}
          {required && (
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true"> *</span>
          )}
        </label>
        <BoundedTextarea
          id={inputId}
          maxLength={INPUT_LIMITS.REASON}
          value={value}
          aria-required={required || undefined}
          error={visibleError || undefined}
          onBlur={() => setTouched(true)}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          placeholder={
            required ? "Archive reason (required)" : "Completion note (optional)"
          }
          className="w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[10px] outline-none"
        />
      </div>
      <WorkspaceTooltip content={buttonTooltip} disabled={!buttonTooltip}>
        <span className="mt-2 inline-flex">
          <button
            type="button"
            disabled={busy || Boolean(rawError)}
            onClick={() => {
              setTouched(true);
              if (rawError) return;
              void onSubmit();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] text-white disabled:opacity-40"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            {button}
          </button>
        </span>
      </WorkspaceTooltip>
    </div>
  );
}
