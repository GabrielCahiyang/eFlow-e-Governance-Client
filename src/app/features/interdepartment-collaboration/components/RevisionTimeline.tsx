import { Avatar, Label } from "@vibe/core";
import { formatManilaDateTime } from "../../../shared/calendarDisplay";
import { GitCompareArrows, History } from "lucide-react";
import type { UserProfile } from "../../../types";
import { summarizeRevisionDiff } from "../selectors/revisionDiff";
import type { CollaborationRevision } from "../types";

export function RevisionTimeline({
  revisions,
  profiles,
}: {
  revisions: CollaborationRevision[];
  profiles: UserProfile[];
}) {
  const sorted = [...revisions].sort(
    (a, b) => b.revisionNumber - a.revisionNumber,
  );

  return (
    <div className="space-y-4">
      <section className="eflow-section-card">
        <header>
          <h2>Proposal revision history ({revisions.length})</h2>
          <p className="m-0 mt-1 text-xs text-secondary">
            Immutable audit record of all proposal modifications, plan adjustments, and diff summaries.
          </p>
        </header>

        <div className="divide-y divide-neutral-100">
          {sorted.map((revision, index) => {
            const previous = sorted[index + 1];
            const diff = previous
              ? summarizeRevisionDiff(previous.snapshot, revision.snapshot)
              : ["Initial proposal snapshot established."];
            const author = profiles.find(
              (profile) => profile.id === revision.createdBy,
            );
            const isCurrent = index === 0;

            return (
              <div
                key={revision.id}
                className={`p-5 transition-colors ${
                  isCurrent ? "bg-blue-50/20" : "bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      isCurrent
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                    }`}
                  >
                    {isCurrent ? (
                      <GitCompareArrows size={18} />
                    ) : (
                      <History size={18} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-neutral-900">
                        Revision {revision.revisionNumber}
                      </span>
                      {isCurrent ? (
                        <Label text="Active current" color="primary" />
                      ) : (
                        <Label text="Historical" color="dark" />
                      )}
                    </div>

                    <div className="mt-1 text-xs font-medium text-neutral-800">
                      {revision.changeSummary}
                    </div>

                    {/* Diff highlights */}
                    <div className="mt-2.5 rounded-lg border border-neutral-200/80 bg-neutral-50/70 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-secondary mb-1.5">
                        Changes recorded:
                      </div>
                      <div className="space-y-1">
                        {diff.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-xs text-neutral-700"
                          >
                            <span className="text-neutral-400 select-none">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Author & Timestamp */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-secondary">
                      <Avatar
                        text={
                          author?.full_name
                            ? author.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                            : "US"
                        }
                        size="small"
                      />
                      <span>
                        Published by{" "}
                        <span className="font-semibold text-neutral-800">
                          {author?.full_name || "Authorized User"}
                        </span>
                      </span>
                      <span>·</span>
                      <time>
                        {formatManilaDateTime(revision.createdAt, "—")}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
