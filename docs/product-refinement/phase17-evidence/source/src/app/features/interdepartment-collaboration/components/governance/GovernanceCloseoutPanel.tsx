import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
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
    },
    decisionOrgId,
  );
  const previousReceipt = React.useRef(savedReceipt);
  React.useEffect(() => {
    if (previousReceipt.current !== savedReceipt) {
      previousReceipt.current = savedReceipt;
      setBaseline({ note, reason, resolution, meetingDate });
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
            <div className="text-[10px] font-medium text-primary">
              Request final verification
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Closeout note and final deliverables summary"
              className="mt-2 w-full resize-none rounded-lg border border-primary/25 bg-white px-3 py-2 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRequest(note)}
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
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                placeholder="Board resolution number (optional)"
                className="h-9 rounded-lg border border-amber-200 bg-white px-3 text-[10px] outline-none"
              />
              <input
                type="date"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                className="h-9 rounded-lg border border-amber-200 bg-white px-3 text-[10px] outline-none"
              />
            </div>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              placeholder="Endorsement or required correction"
              className="mt-2 w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-[10px] outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  void onDecide("approved", reason, resolution, meetingDate)
                }
                className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] text-white"
              >
                Approve closeout
              </button>
              <button
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void onDecide(
                    "changes_requested",
                    reason,
                    resolution,
                    meetingDate,
                  )
                }
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[10px] text-amber-800 disabled:opacity-40"
              >
                Request correction
              </button>
              <button
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void onDecide("declined", reason, resolution, meetingDate)
                }
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[10px] text-red-700 disabled:opacity-40"
              >
                Decline
              </button>
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
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium text-emerald-900">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-[9px] text-emerald-700">{description}</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        placeholder={
          required ? "Archive reason (required)" : "Completion note (optional)"
        }
        className="mt-2 w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[10px] outline-none"
      />
      <button
        type="button"
        disabled={busy || (required && !value.trim())}
        onClick={() => void onSubmit()}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] text-white disabled:opacity-40"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        {button}
      </button>
    </div>
  );
}
