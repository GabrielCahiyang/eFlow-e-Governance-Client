import * as React from "react";
import { Button, IconButton, Label } from "@vibe/core";
import { Collapse, Expand } from "@vibe/icons";
import type { Organization } from "../../../types";
import type { CollaborationDraftSnapshot } from "../types";
import { CollaborationActivitySection } from "./CollaborationActivitySection";

export function CollaborationPlanPanel({
  snapshot,
  organizations,
  editable,
  onSave,
}: {
  snapshot: CollaborationDraftSnapshot;
  organizations: Organization[];
  editable: boolean;
  onSave: (
    snapshot: CollaborationDraftSnapshot,
    summary: string,
  ) => Promise<void>;
}) {
  const [working, setWorking] = React.useState(snapshot);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(snapshot.tasks.map((task) => task.projectId)),
  );
  React.useEffect(() => setWorking(snapshot), [snapshot]);

  const participating = working.organizations.filter(
    (item) =>
      item.participationRole === "owner" ||
      item.participationRole === "participant",
  );

  const projects = Array.from(
    new Set(working.tasks.map((task) => task.projectId)),
  ).map((projectId) => ({
    id: projectId,
    title:
      working.tasks.find((task) => task.projectId === projectId)
        ?.projectTitle || "Project",
    tasks: working.tasks.filter((task) => task.projectId === projectId),
  }));

  const patchTask = (
    key: string,
    patch: Partial<(typeof working.tasks)[number]>,
  ) =>
    setWorking((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.key === key ? { ...task, ...patch } : task,
      ),
    }));

  const patchActivity = (
    activityId: string,
    patch: Pick<
      (typeof working.tasks)[number],
      "activityPrimaryOrgId" | "activitySupportingOrgIds"
    >,
  ) =>
    setWorking((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.activityId === activityId
          ? {
              ...task,
              ...patch,
              primaryOrgId: patch.activityPrimaryOrgId,
              supportingOrgIds: patch.activitySupportingOrgIds,
            }
          : task,
      ),
    }));

  const dirty = JSON.stringify(working) !== JSON.stringify(snapshot);
  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await onSave(working, "Proposal plan and responsibilities updated");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">{saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4">
          <div>
            <div className="text-sm font-semibold text-blue-900">
              Owner editing mode
            </div>
            <div className="mt-0.5 text-xs text-blue-700">
              Changes to responsibilities, team, schedule, or budget require participating offices to approve the updated plan.
            </div>
          </div>
          <Button
            size="small"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save plan changes"}
          </Button>
        </div>
      )}

      {projects.map((project) => {
        const isOpen = expanded.has(project.id);
        const toggle = () =>
          setExpanded((current) => {
            const next = new Set(current);
            isOpen ? next.delete(project.id) : next.add(project.id);
            return next;
          });

        return (
          <section key={project.id} className="eflow-section-card">
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <IconButton
                  aria-label={isOpen ? "Collapse project" : "Expand project"}
                  icon={isOpen ? Collapse : Expand}
                  kind="tertiary"
                  size="small"
                  onClick={toggle}
                />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {project.title}
                  </h3>
                  <div className="mt-0.5 text-xs text-neutral-600">
                    {project.tasks.length} proposed task
                    {project.tasks.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <Label text={`${project.tasks.length} tasks`} color="dark" />
            </header>

            {isOpen && (
              <div className="divide-y divide-neutral-100">
                {Array.from(
                  new Set(project.tasks.map((task) => task.activityId)),
                ).map((activityId) => (
                  <CollaborationActivitySection
                    key={activityId}
                    tasks={project.tasks.filter(
                      (task) => task.activityId === activityId,
                    )}
                    organizations={organizations}
                    participating={participating}
                    editable={editable}
                    onPatchTask={patchTask}
                    onPatchActivity={patchActivity}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
