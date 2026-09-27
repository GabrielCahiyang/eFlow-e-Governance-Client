import { AttentionBox, Button, Heading, Loader, Text } from "@vibe/core";
import { Upload } from "@vibe/icons";
import { AssignmentModal } from "./AssignmentModal";
import { DraftCockpit } from "./DraftCockpit";
import { useProposalImportController } from "../hooks/useProposalImportController";
import { OrganizationScopePicker } from "../../interdepartment-collaboration";

export default function ProposalImport({
  onClose,
  inDialog = false,
  embedded = false,
}: {
  onClose?: () => void;
  inDialog?: boolean;
  embedded?: boolean;
}) {
  const {
    allEmployees,
    employeeNotes,
    deptEmployees,
    orgs,
    collaborationOrganizations,
    setCollaborationOrganizations,
    pdfFileRef,
    pdfPhase,
    setPdfPhase,
    pdfFileName,
    setPdfFileName,
    pdfError,
    setPdfError,
    aiQueueStatus,
    decompositionProgress,
    draftTasks,
    setDraftTasks,
    committing,
    autoSaveState,
    commitMessage,
    setCommitMessage,
    assignModalOpen,
    setAssignModalOpen,
    assignModalTaskKey,
    setAssignModalTaskKey,
    currentDraftTask,
    handlePdfFile,
    handleDraftUpdate,
    handleDraftDelete,
    handleDraftAdd,
    handleCommit,
  } = useProposalImportController(onClose);

  return (
    <div
      className={`${embedded ? "p-0" : "p-6"} ${inDialog ? "eflow-creation-builder" : ""}`}
    >
      <div
        className={`mx-auto min-w-0 space-y-6 ${embedded ? "max-w-none" : "max-w-4xl"}`}
      >
        {!embedded && (
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
            <div>
              <Heading className="text-neutral-900" type="h1" weight="medium">
                PDF Proposal Importer
              </Heading>
              <Text className="mt-1 text-neutral-500" type="text3">
                Decompose a government proposal PDF into Programs, Projects, and
                Tasks with AI recommendation.
              </Text>
            </div>
            {onClose && (
              <Button kind="tertiary" onClick={onClose} size="small">
                Cancel
              </Button>
            )}
          </div>
        )}

        <div>
          {pdfPhase === "idle" && (
            <label
              aria-label="Choose a government proposal PDF"
              htmlFor="proposal-import-file"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handlePdfFile(f);
              }}
              className="group block cursor-pointer rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-14 text-center transition-colors duration-100 hover:border-primary hover:bg-primary/10"
            >
              <Upload
                size={40}
                className="mx-auto mb-3 text-primary/60 transition-colors duration-100 group-hover:text-primary"
              />
              <div className="text-sm font-bold text-neutral-800">
                Drop a government proposal PDF here
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                or click to browse · AI decomposes it into Programs → Projects →
                Activities → Tasks
              </div>
              <div className="mt-4 inline-block rounded-full border border-primary/20 bg-card px-4 py-1.5 text-[11px] text-neutral-500 shadow-xs">
                The editable result is saved as a persistent draft before
                approval · no operational work is created yet
              </div>
              <input
                id="proposal-import-file"
                ref={pdfFileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePdfFile(f);
                }}
              />
            </label>
          )}

          {(pdfPhase === "extracting" || pdfPhase === "decomposing") && (
            <div
              aria-live="polite"
              className="rounded-xl border border-neutral-200 bg-white p-14 text-center"
              role="status"
            >
              <div className="mb-4 flex justify-center">
                <Loader size="large" />
              </div>
              <div className="text-base font-bold text-neutral-800">
                {pdfPhase === "extracting"
                  ? "Extracting text from PDF…"
                  : aiQueueStatus?.status === "queued"
                    ? "Your AI request is queued"
                    : "AI is decomposing the proposal…"}
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                {pdfFileName} ·{" "}
                {pdfPhase === "extracting"
                  ? "Reading pages"
                  : aiQueueStatus?.status === "queued"
                    ? `${aiQueueStatus.jobsAhead} request${aiQueueStatus.jobsAhead === 1 ? "" : "s"} ahead of you`
                    : decompositionProgress
                      ? `Part ${decompositionProgress.current} of ${decompositionProgress.total}: ${decompositionProgress.partTitle}`
                      : "Processing with DeepSeek R1 8B"}
              </div>
              {pdfPhase === "decomposing" &&
                aiQueueStatus?.status === "queued" && (
                  <AttentionBox
                    className="mx-auto mt-5 max-w-md text-left"
                    title={`Queue position ${aiQueueStatus.position ?? "—"}`}
                    type="warning"
                    text={
                      aiQueueStatus.jobsAhead > 0
                        ? "Another user is currently using the AI. Your proposal will start automatically when the requests ahead of it finish—please keep this page open."
                        : "The AI worker is preparing your request. Processing will start automatically—please keep this page open."
                    }
                  />
                )}
              <div className="flex justify-center gap-3 mt-6">
                <div
                  className={`w-2 h-2 rounded-full ${pdfPhase === "extracting" ? "bg-primary animate-pulse" : "bg-emerald-500"}`}
                />
                <div
                  className={`w-2 h-2 rounded-full ${pdfPhase === "decomposing" ? "bg-primary animate-pulse" : "bg-neutral-200"}`}
                />
              </div>
            </div>
          )}

          {pdfPhase === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
              <AttentionBox
                text={pdfError || "The proposal could not be imported."}
                title="Import failed"
                type="negative"
              />
              <Button
                className="mt-4"
                color="negative"
                onClick={() => {
                  setPdfPhase("idle");
                  setPdfError("");
                }}
                kind="primary"
                size="small"
              >
                Try Again
              </Button>
            </div>
          )}

          {pdfPhase === "review" && draftTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-neutral-500">
                  AI draft loaded from{" "}
                  <span className="text-neutral-800 font-semibold">
                    {pdfFileName}
                  </span>{" "}
                  · Review the scope, responsibilities, and staffing while eFlow
                  autosaves the draft.
                </div>
                <Button
                  onClick={() => {
                    setPdfPhase("idle");
                    setPdfFileName("");
                    setCommitMessage("");
                    setDraftTasks([]);
                  }}
                  kind="tertiary"
                  size="small"
                >
                  Import Another
                </Button>
              </div>

              <div className="mb-4">
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
              </div>

              <DraftCockpit
                draftTasks={draftTasks}
                employees={
                  allEmployees.length > 0 ? allEmployees : deptEmployees
                }
                allEmployees={allEmployees}
                employeeNotes={employeeNotes}
                onUpdate={handleDraftUpdate}
                onDelete={handleDraftDelete}
                onAdd={handleDraftAdd}
                onOpenModal={(key) => {
                  setAssignModalTaskKey(key);
                  setAssignModalOpen(true);
                }}
                onCommit={handleCommit}
                committing={committing}
                autoSaveState={autoSaveState}
                commitMessage={commitMessage}
              />
            </div>
          )}
        </div>
      </div>

      <AssignmentModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssignModalTaskKey(null);
        }}
        employees={
          allEmployees && allEmployees.length > 0 ? allEmployees : deptEmployees
        }
        employeeNotes={employeeNotes}
        selectedIds={currentDraftTask?.assignedMemberIds || []}
        leadId={currentDraftTask?.leadMemberId || null}
        onConfirm={(memberIds, leadId) => {
          if (assignModalTaskKey) {
            handleDraftUpdate(assignModalTaskKey, {
              assignedMemberIds: memberIds,
              leadMemberId: leadId,
              assignmentException: undefined,
              teamComposition: undefined,
              reasoning:
                "Team assignment manually adjusted by the reviewing manager.",
            });
          }
        }}
      />
    </div>
  );
}
