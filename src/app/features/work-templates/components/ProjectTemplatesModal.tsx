import { CalendarClock, ClipboardList, Layers, X } from "lucide-react";
import { useState } from "react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import type { Employee } from "../../members";
import { RecurringTaskTemplatesPanel, type Task } from "../../tasks";
import type { ProjectTaskTemplate } from "../projectTaskTemplates";
import { ProjectTaskTemplateLibrary } from "./ProjectTaskTemplateLibrary";
import { SubtaskTemplateLibrary } from "./SubtaskTemplateLibrary";
import "./workTemplates.css";

type TemplateTab = "project" | "subtasks" | "recurring";

export function ProjectTemplatesModal({
  open,
  onClose,
  orgId,
  currentUserId,
  canManageDepartment,
  leadingTasks,
  employees,
  onTemplatesChanged,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  currentUserId: string;
  canManageDepartment: boolean;
  leadingTasks: Task[];
  employees: Employee[];
  onTemplatesChanged?: (saved?: ProjectTaskTemplate) => void;
}) {
  const [tab, setTab] = useState<TemplateTab>(canManageDepartment ? "project" : "subtasks");
  if (!open) return null;

  return (
    <FeatureDialog
      open={open}
      onClose={onClose}
      title="Reusable work library"
      description="Standardize project starter templates, Team Leader checklists, and recurring tasks."
      contentClassName="!h-[88vh] !max-w-6xl max-sm:!h-[100dvh]"
      showCloseButton={false}
    >
      <div className="eflow-tpl-modal-shell">
        <div className="eflow-tpl-modal-header">
          <div>
            <div className="eflow-tpl-eyebrow">Projects · Templates</div>
            <h2 className="eflow-tpl-modal-title">Reusable work library</h2>
            <p className="eflow-tpl-modal-subtitle">
              Standardize project starter templates, recurring tasks, and repeatable Team Leader checklists.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close templates library"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X size={17} />
          </button>
        </div>

        <div className="eflow-tpl-tabs-bar">
          <div className="eflow-tpl-tabs" role="tablist" aria-label="Template library sections">
            {canManageDepartment && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "project"}
                data-active={tab === "project"}
                onClick={() => setTab("project")}
                className="eflow-tpl-tab"
              >
                <Layers size={14} />
                Project Starter Templates
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={tab === "subtasks"}
              data-active={tab === "subtasks"}
              onClick={() => setTab("subtasks")}
              className="eflow-tpl-tab"
            >
              <ClipboardList size={14} />
              Subtask Templates
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "recurring"}
              data-active={tab === "recurring"}
              onClick={() => setTab("recurring")}
              className="eflow-tpl-tab"
            >
              <CalendarClock size={14} />
              Recurring Tasks
            </button>
          </div>
        </div>

        <div className="eflow-tpl-modal-body">
          {tab === "project" && canManageDepartment ? (
            <ProjectTaskTemplateLibrary onTemplatesChanged={onTemplatesChanged} />
          ) : tab === "subtasks" ? (
            <SubtaskTemplateLibrary
              orgId={orgId}
              currentUserId={currentUserId}
              canManageDepartment={canManageDepartment}
              leadingTasks={leadingTasks}
              employees={employees}
            />
          ) : (
            <RecurringTaskTemplatesPanel employees={employees} orgId={orgId} />
          )}
        </div>
      </div>
    </FeatureDialog>
  );
}
