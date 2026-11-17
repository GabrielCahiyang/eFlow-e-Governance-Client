import { useState } from 'react';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { ProposalReviewSections } from './ProposalReviewSections';
import { ProposalProcessingStatus } from "./ProposalProcessingStatus";
import { useProcessingGuard } from "../hooks/useProcessingGuard";
import { AttentionBox, Button, Heading, Text } from "@vibe/core";
import { AssignmentModal } from "./AssignmentModal";
import { DraftCockpit } from "./DraftCockpit";
import { useProposalImportController } from "../hooks/useProposalImportController";
import { OrganizationScopePicker } from "../../interdepartment-collaboration";
import { SourceBudgetSummary } from './SourceBudgetSummary';
import type { ProposalImportOptions } from '../types';

import { ProposalPdfForm } from './ProposalPdfForm';

export default function ProposalImport({
  onClose,
  inDialog = false,
  embedded = false,
  onProcessingChange,
}: {
  onClose?: () => void;
  inDialog?: boolean;
  embedded?: boolean;
  onProcessingChange?: (active: boolean) => void;
}) {
  const {
    allEmployees,
    employeeNotes,
    deptEmployees,
    orgs,
    collaborationOrganizations,
    setCollaborationOrganizations,
    pdfPhase,
    setPdfPhase,
    pdfFileName,
    setPdfFileName,
    pdfError, persistenceUncertain, retryAnalysis,
    sourceBudget, moveSourceCost,
    setPdfError,
    aiQueueStatus,
    decompositionProgress,
    draftTasks,
    setDraftTasks,
    committing,
    autoSaveState, autoSaveError, draftDirty, autosavePending, retryAutosave, discardReview,
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
  const [options, setOptions] = useState<ProposalImportOptions>({
    addTasks: true, addSubtasks: true, addBudget: true, assignPeople: true,
  });

  const processing = ["extracting", "validating", "decomposing", "saving"].includes(pdfPhase);
  useProcessingGuard(processing, onProcessingChange);
  useExplicitDraft('Work-plan import review', draftDirty, processing || committing || autosavePending, discardReview);
  const close = () => { if (onClose) void requestNavigation(onClose); };

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
              <Button kind="tertiary" disabled={processing} onClick={close} size="small">
                Cancel
              </Button>
            )}
          </div>
        )}

        <div>
          {pdfPhase === "idle" && <ProposalPdfForm
            options={options}
            onOptionsChange={setOptions}
            onStart={file => void handlePdfFile(file, options)}
            allowDocumentOnly
            hint="The editable result is saved as a persistent draft before approval · no operational work is created yet"
          />}

          {processing && <ProposalProcessingStatus phase={pdfPhase} fileName={pdfFileName} queue={aiQueueStatus} part={decompositionProgress} />}

          {pdfPhase === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
              <AttentionBox
                text={pdfError || "The proposal could not be imported."}
                title="Import failed"
                type="negative"
              />
              {!persistenceUncertain && <Button
                className="mt-4"
                color="negative"
                onClick={retryAnalysis}
                kind="primary"
                size="small"
              >
                Retry analysis
              </Button>}
              <Button className="mt-4" kind="tertiary" onClick={() => void requestNavigation(() => { setPdfPhase("idle"); setPdfError(""); setDraftTasks([]); })}>Change import options</Button>
            </div>
          )}

          {pdfPhase === "review" && (
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
                  onClick={() => void requestNavigation(() => {
                    setPdfPhase("idle");
                    setPdfFileName("");
                    setCommitMessage("");
                    setDraftTasks([]);
                  })}
                  kind="tertiary"
                  size="small"
                >
                  Import Another
                </Button>
              </div>

              {autoSaveError && <div role="alert">{autoSaveError}<button className="eflow-text-button" onClick={() => void retryAutosave().catch(() => {})}>Retry saving draft</button></div>}
              {sourceBudget&&<SourceBudgetSummary source={sourceBudget} tasks={draftTasks} onMove={moveSourceCost}/>}
              {!draftTasks.length ? <div className="rounded-xl border border-neutral-200 p-4">
                <p>{commitMessage || 'No tasks are included in this draft.'}</p>
                {onClose && <Button kind="tertiary" onClick={close}>Done</Button>}
              </div> : <ProposalReviewSections tasks={draftTasks} officeCount={collaborationOrganizations.length} scope={<div className="mb-4">
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
              </div>} work={<DraftCockpit
                fundingOrgId={collaborationOrganizations.find(item=>item.participationRole==="owner")?.orgId}
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
              />}/>}
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
