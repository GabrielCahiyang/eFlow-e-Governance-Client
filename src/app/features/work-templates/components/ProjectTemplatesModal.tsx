import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { Layers, X } from "lucide-react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import type { Employee } from "../../members";
import type { Task } from "../../tasks";
import type { ProjectTaskTemplate } from "../projectTaskTemplates";
import { ProjectTaskTemplateLibrary } from "./ProjectTaskTemplateLibrary";
import "./workTemplates.css";

export function ProjectTemplatesModal({
  open,
  onClose,
  orgId: _orgId,
  currentUserId: _currentUserId,
  canManageDepartment,
  leadingTasks: _leadingTasks,
  employees: _employees,
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
  if (!open) return null;

  return (
    <FeatureDialog
      open={open}
      onClose={onClose}
      title="Reusable work library"
      description="Standardize project starter templates."
      contentClassName="!h-[88vh] !max-w-6xl max-sm:!h-[100dvh]"
      showCloseButton={false}
    >
      <div className="eflow-tpl-modal-shell">
        <div className="eflow-tpl-modal-header">
          <div>
            <div className="eflow-tpl-eyebrow">Projects · Templates</div>
            <h2 className="eflow-tpl-modal-title">Reusable work library</h2>
            <p className="eflow-tpl-modal-subtitle">
              Standardize project starter templates.
            </p>
          </div>
          <WorkspaceTooltip content="Close templates library"><button
            type="button"
            aria-label="Close templates library"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X size={17} />
          </button></WorkspaceTooltip>
        </div>

        <div className="eflow-tpl-tabs-bar">
          <div className="eflow-tpl-tabs" role="tablist" aria-label="Template library sections">
            {canManageDepartment && (
              <button
                type="button"
                role="tab"
                aria-selected={true}
                data-active={true}
                className="eflow-tpl-tab"
              >
                <Layers size={14} />
                Project Starter Templates
              </button>
            )}
          </div>
        </div>

        <div className="eflow-tpl-modal-body">
          {canManageDepartment && (
            <ProjectTaskTemplateLibrary onTemplatesChanged={onTemplatesChanged} />
          )}
        </div>
      </div>
    </FeatureDialog>
  );
}
