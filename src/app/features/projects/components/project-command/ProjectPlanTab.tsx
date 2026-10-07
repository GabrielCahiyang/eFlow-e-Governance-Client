import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Label,
  TextArea,
  TextField,
} from "@vibe/core";
import { Add, Delete, MoveArrowDown, MoveArrowUp, Update } from "@vibe/icons";
import type { UserProfile } from "../../../../types";
import { useToast } from "../../../../components/ui/Toast";
import { ProjectLifecycleLabel } from "../../presentation/projectPresentation";
import {
  createMilestone,
  deleteMilestone,
  reorderMilestones,
  setMilestoneManualStatus,
  updateMilestone,
  updateProject,
} from "../../services/projectService";
import type {
  MilestoneStatus,
  ProjectPriority,
  ProjectStatus,
} from "../../services/types";
import type { ProjectCommandData } from "./types";

export function ProjectPlanTab({
  data,
  profiles,
  canManage,
}: {
  data: ProjectCommandData;
  profiles: UserProfile[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const project = data.project;
  const locked = project.status === "archived" || !canManage;
  const ownerProfile = profiles.find((p) => p.id === project.ownerId);
  const [form, setForm] = useState({
    title: project.title,
    description: project.description,
    status: project.status,
    priority: project.priority,
    startDate: project.startDate || "",
    targetDate: project.targetDate || "",
    ownerId: project.ownerId || "",
  });
  const [newMilestone, setNewMilestone] = useState("");
  const [newDue, setNewDue] = useState("");
  useEffect(
    () =>
      setForm({
        title: project.title,
        description: project.description,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate || "",
        targetDate: project.targetDate || "",
        ownerId: project.ownerId || "",
      }),
    [project],
  );

  const saveProject = async () => {
    try {
      await updateProject(project.id, form);
      toast("Project plan updated.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not update the project.", "error");
    }
  };
  const addMilestone = async () => {
    if (!newMilestone.trim()) return;
    try {
      await createMilestone(project.id, newMilestone, newDue || null);
      setNewMilestone("");
      setNewDue("");
      toast("Activity added.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not add the activity.", "error");
    }
  };
  const moveMilestone = async (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= data.milestones.length) return;
    const ids = data.milestones.map((milestone) => milestone.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(destination, 0, moved);
    try {
      await reorderMilestones(project.id, ids);
      toast("Activity order updated.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not reorder activities.", "error");
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,.75fr)_minmax(0,1.25fr)]">
      <section className="eflow-section-card">
        <header>
          <h2>Project plan</h2>
          <p className="m-0 mt-1 text-sm">
            Ownership and project changes are written to the audit log.
          </p>
        </header>
        {locked ? (
          <div className="p-4 space-y-4">
            <div>
              <span className="eflow-readonly-label">Project title</span>
              <div className="mt-1 text-base font-semibold text-neutral-900">
                {project.title}
              </div>
            </div>
            <div>
              <span className="eflow-readonly-label">Description</span>
              <p className="m-0 mt-1 text-sm text-secondary leading-relaxed">
                {project.description || "No project description recorded."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
              <div className="eflow-readonly-item">
                <span className="eflow-readonly-label">Lifecycle status</span>
                <div className="mt-1">
                  <ProjectLifecycleLabel status={project.status} />
                </div>
              </div>
              <div className="eflow-readonly-item">
                <span className="eflow-readonly-label">Priority</span>
                <div className="mt-1">
                  <Label
                    text={(project.priority || "medium").replace(/^./, (l) =>
                      l.toUpperCase(),
                    )}
                    color={
                      project.priority === "high"
                        ? "negative"
                        : project.priority === "low"
                          ? "dark"
                          : "working_orange"
                    }
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
              <div className="eflow-readonly-item">
                <span className="eflow-readonly-label">Project lead</span>
                <div className="mt-1 flex items-center gap-2">
                  {ownerProfile ? (
                    <>
                      <Avatar
                        text={ownerProfile.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                        size="small"
                      />
                      <span className="text-sm font-medium text-neutral-900">
                        {ownerProfile.full_name}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-secondary">Unassigned</span>
                  )}
                </div>
              </div>
              <div className="eflow-readonly-item">
                <span className="eflow-readonly-label">Target date</span>
                <div className="mt-1 text-sm font-medium text-neutral-900">
                  {project.targetDate || "Not scheduled"}
                </div>
              </div>
            </div>
            <p className="m-0 pt-2 text-xs text-secondary border-t border-neutral-100">
              This plan is in read-only oversight mode for your current access level.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4">
            <Field label="Title">
              <TextField
                value={form.title}
                onChange={(value) => setForm({ ...form, title: value })}
                inputAriaLabel="Project title"
              />
            </Field>
            <Field label="Description">
              <TextArea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                aria-label="Project description"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as ProjectStatus,
                    })
                  }
                  className="eflow-control"
                >
                  <option value="planning">{project.publicationState === 'draft' ? 'Draft' : 'Planning'}</option>
                  {project.publicationState !== 'draft' && <option value="active">Active</option>}
                  <option value="on_hold">On hold</option>
                  {project.publicationState !== 'draft' && <option value="completed">Completed</option>}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority: event.target.value as ProjectPriority,
                    })
                  }
                  className="eflow-control"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
            </div>
            <Field label="Project lead">
              <select
                value={form.ownerId}
                onChange={(event) =>
                  setForm({ ...form, ownerId: event.target.value })
                }
                className="eflow-control"
              >
                <option value="">Unassigned</option>
                {profiles
                  .filter(
                    (profile) =>
                      profile.is_active &&
                      (!project.orgId || profile.org_id === project.orgId),
                  )
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start date">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm({ ...form, startDate: event.target.value })
                  }
                  className="eflow-control"
                />
              </Field>
              <Field label="Target date">
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(event) =>
                    setForm({ ...form, targetDate: event.target.value })
                  }
                  className="eflow-control"
                />
              </Field>
            </div>
            <Button
              leftIcon={Update}
              disabled={!form.title.trim()}
              onClick={() => void saveProject()}
            >
              Save project plan
            </Button>
          </div>
        )}
      </section>
      <section className="eflow-section-card">
        <header>
          <h2>Activity plan</h2>
          <p className="m-0 mt-1 text-sm">
            Create, order, schedule, and track the activities that deliver this
            project.
          </p>
        </header>
        {canManage && project.status !== "archived" ? (
          <div className="grid gap-2 border-b border-neutral-100 p-4 sm:grid-cols-[1fr_150px_auto]">
            <TextField
              value={newMilestone}
              onChange={setNewMilestone}
              inputAriaLabel="New activity title"
              placeholder="New activity title…"
            />
            <input
              type="date"
              value={newDue}
              onChange={(event) => setNewDue(event.target.value)}
              className="eflow-control"
            />
            <Button
              leftIcon={Add}
              size="small"
              onClick={() => void addMilestone()}
            >
              Add activity
            </Button>
          </div>
        ) : null}
        <div className="space-y-2 p-4">
          {data.milestones.map((milestone, index) => (
            <div key={milestone.id} className="flex items-center gap-1">
              <div className="flex flex-col">
                <IconButton
                  aria-label={`Move ${milestone.title} earlier`}
                icon={MoveArrowUp}
                  kind="tertiary"
                  size="small"
                  disabled={locked || index === 0}
                  onClick={() => void moveMilestone(index, -1)}
                />
                <IconButton
                  aria-label={`Move ${milestone.title} later`}
                icon={MoveArrowDown}
                  kind="tertiary"
                  size="small"
                  disabled={locked || index === data.milestones.length - 1}
                  onClick={() => void moveMilestone(index, 1)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <MilestoneRow
                  milestone={milestone}
                  disabled={locked}
                  onDelete={() =>
                    deleteMilestone(milestone.id).catch((error) =>
                      toast(error.message, "error"),
                    )
                  }
                  onSaved={() => toast("Activity updated.", "success")}
                />
              </div>
            </div>
          ))}
          {data.milestones.length === 0 ? (
            <EmptyState
              title="No activities yet"
              description="Add an activity when work is ready to be planned."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function MilestoneRow({
  milestone,
  disabled,
  onDelete,
  onSaved,
}: {
  milestone: ProjectCommandData["milestones"][number];
  disabled: boolean;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(milestone.title);
  const [dueDate, setDueDate] = useState(milestone.dueDate || "");
  const save = async () => {
    await updateMilestone(milestone.id, { title, dueDate: dueDate || null });
    onSaved();
  };
  return (
    <div className="grid items-center gap-2 rounded-xl border border-neutral-200 p-3 md:grid-cols-[1fr_140px_130px_auto]">
      <input
        disabled={disabled}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="eflow-control"
      />
      <input
        disabled={disabled}
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        className="eflow-control"
      />
      <select
        disabled={disabled}
        value={milestone.manualStatus || "auto"}
        onChange={(event) =>
          void setMilestoneManualStatus(
            milestone.id,
            event.target.value as MilestoneStatus,
            "",
          )
        }
        className="eflow-control"
      >
        <option value="auto">Auto health</option>
        <option value="not_started">Not started</option>
        <option value="in_progress">In progress</option>
        <option value="at_risk">At risk</option>
        <option value="completed">Completed</option>
      </select>
      <div className="flex gap-1">
        <IconButton
          aria-label={`Save ${milestone.title}`}
          icon={Update}
          kind="tertiary"
          size="small"
          disabled={disabled}
          onClick={() => void save()}
        />
        <IconButton
          aria-label={`Delete ${milestone.title}`}
          icon={Delete}
          kind="tertiary"
          size="small"
          disabled={disabled}
          onClick={onDelete}
        />
      </div>
    </div>
  );
}
