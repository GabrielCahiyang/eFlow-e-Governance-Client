import { isAdminRole } from "../../../../shared/roles";
import * as React from "react";
import { Avatar, Button, EmptyState, IconButton, Label, Tooltip } from "@vibe/core";
import { Add, Delete } from "@vibe/icons";
import type { UserProfile } from "../../../../types";
import { useToast } from "../../../../components/ui/Toast";
import {
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
} from "../../services/projectService";
import type { ProjectMember } from "../../services/types";
import type { ProjectCommandData } from "./types";

export function ProjectTeamTab({
  data,
  profiles,
  canManage,
}: {
  data: ProjectCommandData;
  profiles: UserProfile[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState<ProjectMember["role"]>("member");
  const profileMap = React.useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const existingIds = new Set(data.members.map((member) => member.userId));
  const candidates = profiles.filter(
    (profile) =>
      profile.is_active &&
      !isAdminRole(profile.role) &&
      !existingIds.has(profile.id) &&
      (!data.project.orgId || profile.org_id === data.project.orgId),
  );
  const editable = canManage && data.project.status !== "archived";

  const add = async () => {
    if (!userId) return;
    try {
      await addProjectMember(data.project.id, userId, role);
      await data.refreshMembers();
      setUserId("");
      toast("Project member added.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not add member.", "error");
    }
  };

  const remove = async (member: ProjectMember) => {
    try {
      await removeProjectMember(data.project.id, member.userId);
      await data.refreshMembers();
      toast("Project member removed.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not remove member.", "error");
    }
  };

  const changeRole = async (
    member: ProjectMember,
    nextRole: ProjectMember["role"],
  ) => {
    try {
      await updateProjectMemberRole(data.project.id, member.userId, nextRole);
      await data.refreshMembers();
      toast("Project member role updated.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not update member role.", "error");
    }
  };

  return (
    <section className="eflow-section-card max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Project Team &amp; Access</h2>
          <p className="m-0 mt-0.5 text-xs text-neutral-500">
            Assigned personnel and role permissions for project delivery.
          </p>
        </div>
        <span className="text-xs font-semibold text-neutral-500">
          {data.members.length} team members
        </span>
      </header>

      {editable && (
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 p-3">
          <select
            aria-label="Choose a office member"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="eflow-control min-w-[220px] flex-1 text-xs"
          >
            <option value="">Add a office officer or member…</option>
            {candidates.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name} · {profile.role.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Project role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as ProjectMember["role"])
            }
            className="eflow-control w-32 text-xs"
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="owner">Lead / Owner</option>
          </select>
          <Button
            leftIcon={Add}
            size="small"
            disabled={!userId}
            onClick={() => void add()}
          >
            Add
          </Button>
        </div>
      )}

      <div className="divide-y divide-neutral-100">
        {data.members.length ? (
          data.members.map((member) => {
            const profile = profileMap.get(member.userId);
            const label = member.role[0].toUpperCase() + member.role.slice(1);
            return (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3.5 hover:bg-neutral-50/60 transition"
              >
                {/* User details — spatially related */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar
                    text={(profile?.full_name || "User")
                      .split(" ")
                      .map((name) => name[0])
                      .join("")
                      .slice(0, 2)}
                    size="small"
                  />
                  <div className="min-w-0">
                    <strong className="block truncate text-xs font-semibold text-neutral-900">
                      {profile?.full_name || "Unknown member"}
                    </strong>
                    <span className="block text-[11px] text-neutral-400">
                      {profile?.email || profile?.role?.replace(/_/g, " ") || "Member"}
                    </span>
                  </div>
                </div>

                {/* Role / Actions */}
                <div className="flex items-center gap-2">
                  {editable ? (
                    <select
                      aria-label={`Role for ${profile?.full_name || "member"}`}
                      value={member.role}
                      onChange={(event) =>
                        void changeRole(
                          member,
                          event.target.value as ProjectMember["role"],
                        )
                      }
                      className="eflow-control text-xs py-1 px-2 max-w-28"
                    >
                      <option value="owner">Owner</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <Label
                      text={label}
                      color={member.role === "owner" ? "primary" : "dark"}
                    />
                  )}
                  {editable && member.role !== "owner" && (
                    <Tooltip content={`Remove ${profile?.full_name || "member"}`}>
                      <IconButton
                        aria-label={`Remove ${profile?.full_name || "member"}`}
                        icon={Delete}
                        kind="tertiary"
                        size="small"
                        onClick={() => void remove(member)}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState
            title="No project team members"
            description="Add office members who will collaborate on project tasks and milestones."
          />
        )}
      </div>
    </section>
  );
}
