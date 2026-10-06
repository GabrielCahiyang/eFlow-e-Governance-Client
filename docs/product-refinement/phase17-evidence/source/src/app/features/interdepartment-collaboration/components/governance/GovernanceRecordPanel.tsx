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
            <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-[10px] text-neutral-400">
              No Board resolution or meeting minutes have been recorded yet.
            </div>
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
                  · {new Date(signoff.createdAt).toLocaleString()}
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
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              aria-label="Resolution number"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="Resolution number"
              className="h-9 rounded-lg border border-primary/25 bg-white px-3 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <input
              aria-label="Meeting date"
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="h-9 rounded-lg border border-primary/25 bg-white px-3 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <textarea
            aria-label="Endorsement or decision note"
            value={endorsement}
            onChange={(event) => setEndorsement(event.target.value)}
            rows={2}
            placeholder="Endorsement or decision note"
            className="mt-2 w-full resize-none rounded-lg border border-primary/25 bg-white px-3 py-2 text-[10px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 py-2 text-[10px] text-primary transition hover:bg-primary/5">
            <Upload size={11} />{" "}
            {file?.name || current?.minutesFileName || "Attach signed minutes"}
            <input
              type="file"
              accept=".pdf,image/*,.doc,.docx"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSaveRecord({
                resolutionNumber: resolution,
                meetingDate,
                endorsement,
                minutesFile: file,
              })
            }
            className="ml-2 rounded-lg bg-primary px-3 py-2 text-[10px] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
          >
            Save formal record
          </button>
        </div>
      )}
    </section>
  );
}
