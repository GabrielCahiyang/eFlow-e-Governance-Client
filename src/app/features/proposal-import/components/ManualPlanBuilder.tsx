import { useEffect, useMemo, useRef } from "react";
import { FilePenLine, Layers, Plus } from "lucide-react";
import { AssignmentModal } from "./AssignmentModal";
import { DraftCockpit } from "./DraftCockpit";
import { useManualPlanController } from "../hooks/useManualPlanController";
import { OrganizationScopePicker } from "../../interdepartment-collaboration";
import { ProposalTaskBudgetSummary } from "../../budget";

export function ManualPlanBuilder({
  onClose,
  inDialog = false,
  embedded = false,
}: {
  onClose: () => void;
  inDialog?: boolean;
  embedded?: boolean;
}) {
  const {
    allEmployees,
    orgs,
    collaborationOrganizations,
    setCollaborationOrganizations,
    employeesLoading,
    employeeNotes,
    planTitle,
    planTitleError,
    planDescription,
    draftTasks,
    committing,
    autoSaveState,
    commitMessage,
    saveError,
    validationIssues,
    assignModalTaskKey,
    currentDraftTask,
    setPlanDescription,
    setAssignModalTaskKey,
    updatePlanTitle,
    handleAddProgram,
    handleAddProject,
    handleAddActivity,
    handleAddTask,
    handleDraftUpdate,
    handleDraftDelete,
    handleRenameProgram,
    handleRenameProject,
    handleUpdateActivity,
    handleCommit,
  } = useManualPlanController(onClose);
  const planTitleInputRef = useRef<HTMLInputElement>(null);
  const planDescriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const validationMessages = useMemo(
    () => Object.fromEntries(validationIssues.map((issue) => [issue.id, issue.message])),
    [validationIssues],
  );
  const planTitleFieldError = planTitleError || validationMessages["plan-title"];
  const planDescriptionError = validationMessages["plan-description"];

  useEffect(() => {
    if (planTitleFieldError) {
      planTitleInputRef.current?.focus();
    } else if (planDescriptionError) {
      planDescriptionInputRef.current?.focus();
    }
  }, [planDescriptionError, planTitleFieldError]);

  return (
    <div
      className={`${embedded ? "p-0" : "p-6"} font-sans ${inDialog ? "eflow-creation-builder" : ""}`}
      data-testid="manual-plan-builder"
    >
      <div
        className={`mx-auto min-w-0 space-y-6 ${embedded ? "max-w-none" : "max-w-4xl"}`}
      >
        {!embedded && (
          <header className="flex items-start justify-between gap-5 border-b border-neutral-100 pb-4">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FilePenLine size={19} />
              </div>
              <div>
                <h1 className="text-[18px] font-bold text-neutral-900">
                  Manual work-plan builder
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Build Programs, Projects, Activities, and Tasks yourself. AI
                  is not used here. Your review draft autosaves; operational
                  work is created only after approval and commit.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-xs font-semibold text-neutral-500 transition hover:text-neutral-900"
            >
              Cancel
            </button>
          </header>
        )}

        <section className="grid gap-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xs md:grid-cols-[1fr_1.35fr]">
          <label className="block">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-neutral-700">
              Plan title <span className="text-red-500">*</span>
            </span>
            <input
              ref={planTitleInputRef}
              aria-label="Plan title"
              aria-describedby={planTitleFieldError ? "manual-plan-title-error" : undefined}
              aria-invalid={Boolean(planTitleFieldError)}
              data-testid="manual-plan-title"
              value={planTitle}
              onChange={(event) => updatePlanTitle(event.target.value)}
              placeholder="e.g. 2026 Coastal Resilience Plan"
              className={`mt-2 h-10 w-full rounded-xl border bg-neutral-50/60 px-3.5 text-xs text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:bg-white focus:ring-2 ${
                planTitleFieldError
                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                  : "border-neutral-200 focus:border-ring focus:ring-ring/20"
              }`}
            />
            {planTitleFieldError && (
              <span
                id="manual-plan-title-error"
                role="alert"
                className="mt-2 block text-[11px] font-medium text-destructive"
              >
                {planTitleFieldError}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-neutral-700">
              Plan description
            </span>
            <textarea
              ref={planDescriptionInputRef}
              aria-label="Plan description"
              aria-describedby={planDescriptionError ? "manual-plan-description-error" : undefined}
              aria-invalid={Boolean(planDescriptionError)}
              data-testid="manual-plan-description"
              value={planDescription}
              onChange={(event) => setPlanDescription(event.target.value)}
              placeholder="What is this plan intended to deliver?"
              rows={2}
              className={`mt-2 w-full resize-none rounded-xl border bg-neutral-50/60 px-3.5 py-2.5 text-xs text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:bg-white focus:ring-2 ${
                planDescriptionError
                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                  : "border-neutral-200 focus:border-ring focus:ring-ring/20"
              }`}
            />
            {planDescriptionError && (
              <span
                id="manual-plan-description-error"
                role="alert"
                className="mt-2 block text-[11px] font-medium text-destructive"
              >
                {planDescriptionError}
              </span>
            )}
          </label>
        </section>

        <OrganizationScopePicker
          organizations={orgs}
          value={collaborationOrganizations}
          ownerOrgId={
            collaborationOrganizations.find(
              (item) => item.participationRole === "owner",
            )?.orgId || ""
          }
          onChange={setCollaborationOrganizations}
        />

        {draftTasks.length > 0 && (
          <ProposalTaskBudgetSummary tasks={draftTasks} />
        )}

        {draftTasks.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-card text-primary shadow-sm">
              <Layers size={22} />
            </div>
            <h2 className="mt-4 text-sm font-bold text-neutral-800">
              Start with a Program
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-neutral-500">
              A Program can contain multiple Projects. Each Project can contain
              Activities, and every Activity can contain one or more tasks.
            </p>
            <button
              data-testid="manual-plan-add-first-program"
              onClick={handleAddProgram}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring cursor-pointer"
            >
              <Plus size={14} /> Add first Program
            </button>
          </section>
        ) : (
          <DraftCockpit
            fundingOrgId={collaborationOrganizations.find(item=>item.participationRole==="owner")?.orgId}
            source="manual"
            proposalTitle={planTitle || "Untitled plan"}
            draftTasks={draftTasks}
            employees={allEmployees}
            employeeNotes={employeeNotes}
            onUpdate={handleDraftUpdate}
            onDelete={handleDraftDelete}
            onAdd={handleAddTask}
            onOpenModal={setAssignModalTaskKey}
            onCommit={handleCommit}
            committing={committing}
            autoSaveState={autoSaveState}
            commitMessage={commitMessage}
            saveError={saveError}
            validationMessages={validationMessages}
            onAddProgram={handleAddProgram}
            onAddProject={handleAddProject}
            onAddActivity={handleAddActivity}
            onRenameProgram={handleRenameProgram}
            onRenameProject={handleRenameProject}
            onUpdateActivity={handleUpdateActivity}
          />
        )}
      </div>

      <AssignmentModal
        open={Boolean(assignModalTaskKey)}
        onClose={() => setAssignModalTaskKey(null)}
        employees={allEmployees}
        loading={employeesLoading}
        employeeNotes={employeeNotes}
        selectedIds={currentDraftTask?.assignedMemberIds || []}
        leadId={currentDraftTask?.leadMemberId || null}
        onConfirm={(memberIds, leadMemberId) => {
          if (assignModalTaskKey) {
            handleDraftUpdate(assignModalTaskKey, {
              assignedMemberIds: memberIds,
              leadMemberId,
            });
          }
          setAssignModalTaskKey(null);
        }}
      />
    </div>
  );
}
