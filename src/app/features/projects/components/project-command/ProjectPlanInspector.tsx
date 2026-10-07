import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Label,
  TextArea,
  TextField,
} from "@vibe/core";
import {
  Add,
  Close,
  Delete,
  MoveArrowDown,
  MoveArrowUp,
  Settings,
  Update,
} from "@vibe/icons";
import { Calendar, Clock, Sparkles } from "lucide-react";
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

export interface ProjectPlanInspectorProps {
  data: ProjectCommandData;
  profiles: UserProfile[];
  canManage: boolean;
  isOpen: boolean;
  onClose: () => void;
  selectedActivityId?: string | null;
  onSelectActivity?: (activityId: string | null) => void;
}

export function ProjectPlanInspector({
  data,
  profiles,
  canManage,
  isOpen,
  onClose,
  selectedActivityId,
  onSelectActivity,
}: ProjectPlanInspectorProps) {
  const { toast } = useToast();
  const project = data.project;
  const locked = project.status === "archived" || !canManage;
  const ownerProfile = profiles.find((p) => p.id === project.ownerId);

  const [activeTab, setActiveTab] = useState<"activities" | "settings">("activities");
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
  const activityListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm({
      title: project.title,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate || "",
      targetDate: project.targetDate || "",
      ownerId: project.ownerId || "",
    });
  }, [project]);

  // When an activity is selected from the timeline, switch to activities tab and scroll to it
  useEffect(() => {
    if (selectedActivityId) {
      setActiveTab("activities");
      const element = document.getElementById(`plan-inspector-activity-${selectedActivityId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedActivityId]);

  if (!isOpen) return null;

  const saveProject = async () => {
    try {
      await updateProject(project.id, form);
      toast("Project plan settings updated.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not update the project settings.", "error");
    }
  };

  const addMilestone = async () => {
    if (!newMilestone.trim()) return;
    try {
      await createMilestone(project.id, newMilestone.trim(), newDue || null);
      setNewMilestone("");
      setNewDue("");
      toast("Activity added to plan.", "success");
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
    <aside
      className="eflow-plan-inspector"
      aria-label="Manage project plan"
      role="dialog"
      aria-modal="false"
    >
      <div className="eflow-plan-inspector__header">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Sparkles size={13} />
            <span>Project Planning</span>
          </div>
          <h3 className="eflow-plan-inspector__title">Manage Plan</h3>
          <p className="eflow-plan-inspector__subtitle">
            Configure delivery schedule and activities
          </p>
        </div>
        <IconButton
          aria-label="Close manage plan inspector"
          icon={Close}
          kind="tertiary"
          size="small"
          onClick={onClose}
        />
      </div>

      {/* Inspector Tab Switcher */}
      <div className="eflow-plan-inspector__tabs">
        <button
          type="button"
          className={`eflow-plan-inspector__tab ${activeTab === "activities" ? "eflow-plan-inspector__tab--active" : ""}`}
          onClick={() => setActiveTab("activities")}
        >
          <Clock size={14} />
          <span>Activities ({data.milestones.length})</span>
        </button>
        <button
          type="button"
          className={`eflow-plan-inspector__tab ${activeTab === "settings" ? "eflow-plan-inspector__tab--active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <Settings size={14} />
          <span>Project Settings</span>
        </button>
      </div>

      <div className="eflow-plan-inspector__body">
        {activeTab === "activities" && (
          <div className="space-y-4" ref={activityListRef}>
            {/* Quick add activity form */}
            {!locked && (
              <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/80 p-3 shadow-xs">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                  Add New Delivery Activity
                </span>
                <div className="grid gap-2">
                  <TextField
                    value={newMilestone}
                    onChange={setNewMilestone}
                    inputAriaLabel="New activity title"
                    placeholder="e.g. Environmental Impact Assessment..."
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newDue}
                      onChange={(event) => setNewDue(event.target.value)}
                      className="eflow-control flex-1 text-xs"
                      aria-label="Activity target date"
                    />
                    <Button
                      leftIcon={Add}
                      size="small"
                      disabled={!newMilestone.trim()}
                      onClick={() => void addMilestone()}
                    >
                      Add activity
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Activities list */}
            <div className="space-y-2.5">
              {data.milestones.map((milestone, index) => {
                const isSelected = selectedActivityId === milestone.id;
                return (
                  <div
                    key={milestone.id}
                    id={`plan-inspector-activity-${milestone.id}`}
                    className={`flex items-start gap-1 rounded-xl transition ${
                      isSelected ? "ring-2 ring-blue-500/80 bg-blue-50/30" : ""
                    }`}
                  >
                    {!locked && (
                      <div className="flex flex-col pt-1">
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
                    )}
                    <div className="min-w-0 flex-1">
                      <ActivityInspectorCard
                        milestone={milestone}
                        disabled={locked}
                        isSelected={isSelected}
                        onSelect={() => onSelectActivity?.(milestone.id)}
                        onDelete={() =>
                          deleteMilestone(milestone.id).catch((error) =>
                            toast(error.message, "error"),
                          )
                        }
                        onSaved={() => toast("Activity updated.", "success")}
                      />
                    </div>
                  </div>
                );
              })}

              {data.milestones.length === 0 && (
                <EmptyState
                  title="No activities yet"
                  description="Add an activity above to schedule milestones and work items for this project."
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            {locked ? (
              <div className="space-y-3.5 rounded-xl border border-neutral-200 bg-white p-4">
                <div>
                  <span className="eflow-readonly-label">Project Title</span>
                  <div className="mt-1 text-sm font-semibold text-neutral-900">
                    {project.title}
                  </div>
                </div>
                <div>
                  <span className="eflow-readonly-label">Description</span>
                  <p className="m-0 mt-1 text-xs leading-relaxed text-secondary">
                    {project.description || "No project description recorded."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
                  <div className="eflow-readonly-item">
                    <span className="eflow-readonly-label">Lifecycle</span>
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
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
                  <div className="eflow-readonly-item">
                    <span className="eflow-readonly-label">Project Lead</span>
                    <div className="mt-1 flex items-center gap-1.5">
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
                          <span className="truncate text-xs font-medium text-neutral-900">
                            {ownerProfile.full_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-secondary">Unassigned</span>
                      )}
                    </div>
                  </div>
                  <div className="eflow-readonly-item">
                    <span className="eflow-readonly-label">Target Date</span>
                    <div className="mt-1 text-xs font-medium text-neutral-900">
                      {project.targetDate || "Not scheduled"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 rounded-xl border border-neutral-200 bg-white p-4">
                <Field label="Project Title">
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

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Lifecycle Status">
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value as ProjectStatus,
                        })
                      }
                      className="eflow-control text-xs"
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
                      className="eflow-control text-xs"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </Field>
                </div>

                <Field label="Project Lead">
                  <select
                    value={form.ownerId}
                    onChange={(event) =>
                      setForm({ ...form, ownerId: event.target.value })
                    }
                    className="eflow-control text-xs"
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

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Start Date">
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        setForm({ ...form, startDate: event.target.value })
                      }
                      className="eflow-control text-xs"
                    />
                  </Field>
                  <Field label="Target Date">
                    <input
                      type="date"
                      value={form.targetDate}
                      onChange={(event) =>
                        setForm({ ...form, targetDate: event.target.value })
                      }
                      className="eflow-control text-xs"
                    />
                  </Field>
                </div>

                <div className="pt-2">
                  <Button
                    leftIcon={Update}
                    disabled={!form.title.trim()}
                    onClick={() => void saveProject()}
                  >
                    Save project settings
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
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
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ActivityInspectorCard({
  milestone,
  disabled,
  isSelected,
  onSelect,
  onDelete,
  onSaved,
}: {
  milestone: ProjectCommandData["milestones"][number];
  disabled: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(milestone.title);
  const [dueDate, setDueDate] = useState(milestone.dueDate || "");
  const [isExpanded, setIsExpanded] = useState(isSelected || false);

  useEffect(() => {
    setTitle(milestone.title);
    setDueDate(milestone.dueDate || "");
  }, [milestone]);

  useEffect(() => {
    if (isSelected) {
      setIsExpanded(true);
    }
  }, [isSelected]);

  const save = async () => {
    await updateMilestone(milestone.id, { title, dueDate: dueDate || null });
    onSaved();
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "completed":
        return { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "at_risk":
        return { label: "At Risk", color: "bg-rose-50 text-rose-700 border-rose-200" };
      case "in_progress":
        return { label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200" };
      default:
        return { label: "Not Started", color: "bg-neutral-50 text-neutral-700 border-neutral-200" };
    }
  };

  const badge = getStatusBadge(milestone.status || milestone.manualStatus);

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs transition hover:border-neutral-300 ${
        isSelected ? "border-blue-300 bg-blue-50/10" : ""
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                milestone.status === "completed"
                  ? "bg-emerald-500"
                  : milestone.status === "at_risk"
                    ? "bg-rose-500"
                    : "bg-blue-500"
              }`}
            />
            <span className="truncate text-xs font-semibold text-neutral-900">
              {milestone.title}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />
              {milestone.dueDate ? milestone.dueDate : "No target date"}
            </span>
            <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[9.5px] font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? "Collapse" : "Edit"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2.5 border-t border-neutral-100 pt-2.5">
          <Field label="Activity Title">
            <input
              disabled={disabled}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="eflow-control text-xs"
              placeholder="Activity title"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Target Date">
              <input
                disabled={disabled}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="eflow-control text-xs"
              />
            </Field>

            <Field label="Health Status">
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
                className="eflow-control text-xs"
              >
                <option value="auto">Auto health</option>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="at_risk">At risk</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>

          {!disabled && (
            <div className="flex items-center justify-between pt-1">
              <IconButton
                aria-label={`Delete ${milestone.title}`}
                icon={Delete}
                kind="tertiary"
                size="small"
                onClick={onDelete}
              />
              <Button
                leftIcon={Update}
                size="small"
                onClick={() => void save()}
              >
                Save changes
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
