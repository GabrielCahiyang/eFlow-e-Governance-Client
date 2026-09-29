import * as React from "react";
import { Avatar, Button, Label, Tooltip } from "@vibe/core";
import { Crown, Sparkles, X } from "lucide-react";
import type { Organization, UserProfile } from "../../../types";
import type { CollaborationDraftSnapshot } from "../types";
import type { CollaborationCandidateRecommendation } from "../services/collaborationCandidateService";

export function StaffingReviewPanel({
  snapshot,
  organizations,
  profiles,
  editableOrgId,
  canEditAll,
  onSave,
  onRecommend,
}: {
  snapshot: CollaborationDraftSnapshot;
  organizations: Organization[];
  profiles: UserProfile[];
  editableOrgId?: string;
  canEditAll: boolean;
  onSave: (
    snapshot: CollaborationDraftSnapshot,
    summary: string,
  ) => Promise<void>;
  onRecommend?: () => Promise<CollaborationCandidateRecommendation[]>;
}) {
  const [working, setWorking] = React.useState(snapshot);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [recommending, setRecommending] = React.useState(false);
  React.useEffect(() => setWorking(snapshot), [snapshot]);

  const eligibleOrgIds = new Set(
    snapshot.organizations
      .filter((item) => item.staffingEnabled)
      .map((item) => item.orgId),
  );
  const eligibleProfiles = profiles.filter(
    (profile) =>
      profile.is_active &&
      profile.role !== "super_admin" &&
      eligibleOrgIds.has(profile.org_id || ""),
  );
  const canModifyOrg = (orgId: string | null) =>
    canEditAll || Boolean(orgId && orgId === editableOrgId);

  const toggleMember = (taskKey: string, profile: UserProfile) =>
    setWorking((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.key !== taskKey || !canModifyOrg(profile.org_id)) return task;
        const selected = task.assignedMemberIds.includes(profile.id);
        const assignedMemberIds = selected
          ? task.assignedMemberIds.filter((id) => id !== profile.id)
          : [...task.assignedMemberIds, profile.id];
        return {
          ...task,
          assignedMemberIds,
          leadMemberId:
            task.leadMemberId === profile.id
              ? assignedMemberIds[0] || null
              : task.leadMemberId || profile.id,
        };
      }),
    }));

  const dirty = JSON.stringify(working) !== JSON.stringify(snapshot);
  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await onSave(
        working,
        `${
          canEditAll
            ? "Owner"
            : organizations.find((org) => org.id === editableOrgId)?.name ||
              "Participant"
        } staffing updated`,
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const recommend = async () => {
    if (!onRecommend) return;
    setRecommending(true);
    try {
      const recommendations = await onRecommend();
      setWorking((current) => ({
        ...current,
        tasks: current.tasks.map((task) => {
          const items = recommendations.filter(
            (item) => item.taskKey === task.key,
          );
          if (items.length === 0) return task;
          const lead =
            items.find((item) => item.recommendedRole === "lead") || items[0];
          return {
            ...task,
            assignedMemberIds: Array.from(
              new Set(items.map((item) => item.employeeId)),
            ),
            leadMemberId: lead.employeeId,
            reasoning: items.map((item) => item.fitReason).join(" "),
          };
        }),
      }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Team suggestions could not be loaded.");
    } finally {
      setRecommending(false);
    }
  };

  return (
    <div className="space-y-4">{saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
      <section className="eflow-section-card">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Interdepartmental staffing roster</h2>
            <p className="m-0 mt-1 text-xs text-neutral-600">
              Proposed team assignments remain in draft review and become live upon proposal commit.
            </p>
          </div>
          <div className="flex gap-2">
            {canEditAll && onRecommend && (
              <Button
                kind="secondary"
                size="small"
                disabled={recommending}
                onClick={() => void recommend()}
              >
                <Sparkles size={14} className="mr-1.5 text-blue-600" />
                {recommending ? "Ranking candidates…" : "AI recommend teams"}
              </Button>
            )}
            {(canEditAll || editableOrgId) && (
              <Button
                size="small"
                disabled={!dirty || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save team changes"}
              </Button>
            )}
          </div>
        </header>

        <div className="divide-y divide-neutral-100">
          {working.tasks
            .filter((task) => task.enabled)
            .map((task) => {
              const selectedProfiles = task.assignedMemberIds
                .map((id) => profiles.find((profile) => profile.id === id))
                .filter((profile): profile is UserProfile => Boolean(profile));
              const primaryOrg = organizations.find(
                (org) => org.id === task.primaryOrgId,
              );

              return (
                <div key={task.key} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {task.title}
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-600">
                        {task.activityTitle} · Primary office:{" "}
                        <span className="font-medium text-neutral-800">
                          {primaryOrg?.name || "Unassigned"}
                        </span>
                      </div>
                    </div>
                    <Label
                      text={`${selectedProfiles.length} assigned`}
                      color={selectedProfiles.length > 0 ? "positive" : "negative"}
                    />
                  </div>

                  {/* Assigned Members List */}
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {selectedProfiles.map((profile) => {
                      const editable = canModifyOrg(profile.org_id);
                      const org = organizations.find(
                        (item) => item.id === profile.org_id,
                      );
                      const isLead = task.leadMemberId === profile.id;

                      return (
                        <div
                          key={profile.id}
                          className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2"
                        >
                          <Avatar
                            text={profile.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                            size="small"
                          />
                          <div>
                            <div className="text-xs font-semibold text-neutral-900">
                              {profile.full_name}
                            </div>
                            <div className="text-[11px] text-neutral-600">
                              {org?.name} · {isLead ? "Task Lead" : "Support"}
                            </div>
                          </div>

                          {editable && (
                            <div className="flex items-center gap-1 ml-1">
                              <Tooltip
                                content={
                                  isLead
                                    ? "Currently designated lead"
                                    : "Make task leader"
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    (!isLead && window.confirm("Change this task lead? The new lead will be responsible for task updates and submissions.")) && setWorking((current) => ({
                                      ...current,
                                      tasks: current.tasks.map((item) =>
                                        item.key === task.key
                                          ? { ...item, leadMemberId: profile.id }
                                          : item,
                                      ),
                                    }))
                                  }
                                  className={`p-1 rounded ${
                                    isLead
                                      ? "text-amber-500 hover:bg-amber-50"
                                      : "text-neutral-300 hover:text-amber-500"
                                  }`}
                                  aria-label="Set task leader"
                                >
                                  <Crown size={14} />
                                </button>
                              </Tooltip>

                              <button
                                type="button"
                                onClick={() => { if (!task.assignedMemberIds.includes(profile.id) || window.confirm("Remove this team member from the task? If they are the lead, a new lead will be selected.")) toggleMember(task.key, profile); }}
                                className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                aria-label={`Remove ${profile.full_name}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {selectedProfiles.length === 0 && (
                      <div className="text-xs text-red-600 font-medium py-1">
                        No team assigned yet. Assignment is required before publication.
                      </div>
                    )}
                  </div>

                  {/* Available Pool Adder */}
                  {(canEditAll || editableOrgId) && (
                    <div className="mt-3.5 border-t border-neutral-100 pt-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                        Available from{" "}
                        {canEditAll
                          ? "staffing pools"
                          : organizations.find((org) => org.id === editableOrgId)
                              ?.name}
                        :
                      </span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {eligibleProfiles
                          .filter(
                            (profile) =>
                              canEditAll || profile.org_id === editableOrgId,
                          )
                          .filter(
                            (profile) =>
                              !task.assignedMemberIds.includes(profile.id),
                          )
                          .map((profile) => (
                            <button
                              type="button"
                              key={profile.id}
                              onClick={() => { if (!task.assignedMemberIds.includes(profile.id) || window.confirm("Remove this team member from the task? If they are the lead, a new lead will be selected.")) toggleMember(task.key, profile); }}
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                            >
                              <span>+</span>
                              <span>{profile.full_name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
