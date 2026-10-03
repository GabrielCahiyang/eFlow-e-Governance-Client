import * as React from "react";
import { Button, Label } from "@vibe/core";
import { AlertTriangle, Check, Plus } from "lucide-react";
import type { Organization, UserProfile } from "../../../types";
import type {
  CollaborationChangeRequest,
  CollaborationTargetType,
} from "../types";

export function ChangeRequestsPanel({
  requests,
  organizations,
  profiles,
  canRequest,
  canResolve,
  onCreate,
  onResolve,
}: {
  requests: CollaborationChangeRequest[];
  organizations: Organization[];
  profiles: UserProfile[];
  canRequest: boolean;
  canResolve: boolean;
  onCreate: (input: {
    targetType: CollaborationTargetType;
    targetKey: string;
    reason: string;
  }) => Promise<void>;
  onResolve: (
    id: string,
    status: "accepted" | "rejected" | "withdrawn",
  ) => Promise<void>;
}) {
  const [creating, setCreating] = React.useState(false);
  const [targetType, setTargetType] =
    React.useState<CollaborationTargetType>("proposal");
  const [targetKey, setTargetKey] = React.useState("proposal");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!reason.trim() || !targetKey.trim()) return;
    setBusy(true);
    try {
      await onCreate({ targetType, targetKey, reason: reason.trim() });
      setCreating(false);
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="eflow-section-card">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Formal change requests ({requests.length})</h2>
            <p className="m-0 mt-1 text-xs text-secondary">
              Structured modification requirements raised by participating offices. Open requests must be resolved before final commit.
            </p>
          </div>
          {canRequest && !creating && (
            <Button
              size="small"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} className="mr-1.5" />
              Request change
            </Button>
          )}
        </header>

        {creating && (
          <div className="border-b border-neutral-100 bg-amber-50/50 p-5">
            <div className="text-sm font-semibold text-amber-900 mb-3">
              Submit a formal change requirement
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Target level
                </label>
                <select
                  value={targetType}
                  onChange={(event) =>
                    setTargetType(event.target.value as CollaborationTargetType)
                  }
                  className="eflow-control w-full"
                >
                  <option value="proposal">Entire Proposal</option>
                  <option value="program">Program</option>
                  <option value="project">Project</option>
                  <option value="activity">Activity</option>
                  <option value="task">Specific Task</option>
                  <option value="staff_assignment">Staff assignment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Target identifier or item name
                </label>
                <input
                  value={targetKey}
                  onChange={(event) => setTargetKey(event.target.value)}
                  placeholder="e.g. Activity 1 / Task title"
                  className="eflow-control w-full"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Reason for required change
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="Explain why this change is necessary and suggest a resolution…"
                  className="eflow-control w-full h-auto py-2 leading-relaxed"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                kind="tertiary"
                size="small"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button
                size="small"
                disabled={!reason.trim() || !targetKey.trim() || busy}
                onClick={() => void submit()}
              >
                {busy ? "Submitting…" : "Submit requirement"}
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-neutral-100">
          {requests.map((request) => {
            const requester = profiles.find(
              (profile) => profile.id === request.requestedBy,
            );
            const org = organizations.find(
              (item) => item.id === request.requestingOrgId,
            );
            const isOpen = request.status === "open";

            return (
              <div
                key={request.id}
                className={`p-5 transition-colors ${
                  isOpen ? "bg-amber-50/20" : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isOpen
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                      }`}
                    >
                      {isOpen ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <Check size={16} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 capitalize">
                          {request.targetType.replace("_", " ")} · {request.targetKey}
                        </span>
                        <Label
                          text={request.status}
                          color={
                            request.status === "open"
                              ? "working_orange"
                              : request.status === "accepted"
                                ? "positive"
                                : "dark"
                          }
                        />
                      </div>

                      <div className="mt-1.5 text-xs leading-relaxed text-neutral-800 whitespace-pre-wrap">
                        {request.reason}
                      </div>

                      <div className="mt-2 text-[11px] text-secondary">
                        Requested by{" "}
                        <span className="font-medium text-neutral-800">
                          {requester?.full_name || "Office Reviewer"}
                        </span>
                        {org?.name && ` (${org.name})`} ·{" "}
                        {new Date(request.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  {isOpen && canResolve && (
                    <div className="flex items-center gap-2">
                      <Button
                        kind="secondary"
                        size="small"
                        onClick={() => void onResolve(request.id, "accepted")}
                      >
                        Accept
                      </Button>
                      <Button
                        kind="tertiary"
                        size="small"
                        onClick={() => void onResolve(request.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {requests.length === 0 && (
            <div className="py-12 text-center">
              <Check size={28} className="mx-auto text-emerald-500" />
              <div className="mt-3 text-sm font-semibold text-neutral-800">
                No open change requests
              </div>
              <p className="mt-1 text-xs text-secondary">
                All participating offices are aligned with the current proposal plan.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
