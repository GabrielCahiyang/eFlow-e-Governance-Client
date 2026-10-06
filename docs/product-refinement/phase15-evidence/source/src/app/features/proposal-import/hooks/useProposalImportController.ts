import { useProposalDraftPersistence } from './useProposalDraftPersistence';
import { withEmployeeDeadlineWorkload, taskDurationHours, taskEstimateError } from "../../tasks";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTasks, useEmployeeNotes } from "../../../hooks/useFirebaseData";
import { useOrgs } from "../../../hooks/useSupabaseData";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { useDepartmentTeamAnalytics } from "../../team-management";
import { useDeptDirectoryEmployees } from "../../members";
import {
  buildCollaborationSnapshot,
  createCollaborationDraft,
  defaultParticipationRole,
  detectMentionedOrganizations,
  getCollaborationCandidateEmployees,
  type CollaborationOrganizationSelection,
} from "../../interdepartment-collaboration";
import { decomposeProposal, type ProposalDecompositionResult } from "../../../services/proposalDecompositionService";
import { extractTextFromPdf } from "../services/pdfTextExtractor";
import { filterEmployeesByPdfMentions } from "../selectors/employeeMentions";
import { withTeamIntelligenceCandidateWorkload } from "../selectors/candidateWorkload";
import { buildHierarchyIds, type DraftTask, type PdfPhase } from "../components/draftModel";
import type { AiQueueUpdate } from "../../ai";
import { buildProposalBudgetFromTasks } from "../../budget";
import { normalizeImportedTaskBudgetLines } from "../services/proposalBudgetImport";
import { validateProposalDocument } from "../services/proposalValidationClient";

export function useProposalImportController(onClose?: () => void) {
  const { tasks: liveTasks } = useTasks();
  const { notes: employeeNotes } = useEmployeeNotes();
  const { userProfile } = useAuth();
  const { orgs } = useOrgs();
  const teamAnalytics = useDepartmentTeamAnalytics({
    scope: "exact",
    includeCurrentUser: true,
    includeDepartmentHeads: true,
    activeOnly: true,
    excludeAdmins: true,
  });
  const scopedDepartmentEmployees = teamAnalytics.deptEmployees;
  const { allEmployees: directoryEmployees } = useDeptDirectoryEmployees({
    scope: "exact",
    includeCurrentUser: true,
    includeDepartmentHeads: true,
    activeOnly: true,
    excludeAdmins: true,
  });
  const candidateEmployees = useMemo(() => withEmployeeDeadlineWorkload(directoryEmployees, liveTasks), [directoryEmployees, liveTasks]);
  const { toast } = useToast();

  // Proposal drafts can only assign employees directly in the requester's
  // department, never a child unit or unrelated office.
  const deptEmployees = useMemo(
    () => userProfile?.departmentId
      ? withTeamIntelligenceCandidateWorkload(
        scopedDepartmentEmployees,
        teamAnalytics.memberMetrics,
      )
      : [],
    [scopedDepartmentEmployees, teamAnalytics.memberMetrics, userProfile?.departmentId],
  );
  const ownerOrgId = userProfile?.departmentId || userProfile?.org_id || "";
  const [collaborationOrganizations, setCollaborationOrganizations] = useState<CollaborationOrganizationSelection[]>([]);
  useEffect(() => {
    if (!ownerOrgId) return;
    setCollaborationOrganizations((current) => current.some((item) => item.participationRole === "owner")
      ? current
      : [{ orgId: ownerOrgId, participationRole: "owner", staffingEnabled: true }]);
  }, [ownerOrgId]);
  const allEmployees = useMemo(
    () => getCollaborationCandidateEmployees(candidateEmployees, collaborationOrganizations),
    [collaborationOrganizations, candidateEmployees],
  );

  const deptEmployeesWithNotes = useMemo(
    () => deptEmployees.filter((emp) => Boolean(employeeNotes?.[emp.id])),
    [deptEmployees, employeeNotes],
  );

  const employeesForAi = useMemo(
    () =>
      deptEmployeesWithNotes.length > 0
        ? deptEmployeesWithNotes
        : deptEmployees,
    [deptEmployees, deptEmployeesWithNotes],
  );

  const departmentFilter = userProfile?.departmentId || "";

  const pdfFileRef = useRef<HTMLInputElement>(null);
  const [pdfPhase, setPdfPhase] = useState<PdfPhase>("idle");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [persistenceUncertain, setPersistenceUncertain] = useState(false);
  const [aiQueueStatus, setAiQueueStatus] = useState<AiQueueUpdate | null>(null);
  const [decompositionProgress, setDecompositionProgress] = useState<{
    current: number;
    total: number;
    partTitle: string;
  } | null>(null);
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([]);
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const importPending = useRef(false);
  const planningAnchor = useRef(Date.now());

  // Assignment modal for PDF drafts
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalTaskKey, setAssignModalTaskKey] = useState<string | null>(
    null,
  );
  const currentDraftTask = assignModalTaskKey
    ? draftTasks.find((t) => t.key === assignModalTaskKey) || null
    : null;

  const buildDraftTasks = (
    result: ProposalDecompositionResult,
    fallbackProposalTitle?: string,
  ): DraftTask[] => {
    const out: DraftTask[] = [];
    const proposalTitle =
      result.proposal?.title ||
      fallbackProposalTitle ||
      pdfFileName.replace(/\.pdf$/i, "") ||
      "Imported Proposal";
    result.programs.forEach((prog, pi) => {
      prog.projects.forEach((proj, pj) => {
        proj.activities.forEach((act, ai) => {
          const hierarchyIds = buildHierarchyIds(
            proposalTitle,
            prog.title,
            proj.title,
            act.title,
            pi,
            pj,
            ai,
          );
          act.tasks.forEach((t, ti) => {
            const taskKey = `${pi}-${pj}-${ai}-${ti}`;
            out.push({
              key: taskKey,
              proposalTitle,
              proposalId: hierarchyIds.proposalId,
              programIdx: pi,
              projectIdx: pj,
              activityIdx: ai,
              taskIdx: ti,
              programId: hierarchyIds.programId,
              programTitle: prog.title,
              projectId: hierarchyIds.projectId,
              projectTitle: proj.title,
              activityId: hierarchyIds.activityId,
              activityTitle: act.title,
              activitySchedule: act.schedule || "",
              title: t.title,
              description: t.description,
              deadline: act.schedule || "",
              estimatedHours: taskDurationHours(t.estimatedDuration, t.optimizationMetadata?.durationDays),
              priority: t.priority || "medium",
              requiredSkills: t.requiredSkills || [],
              assignedMemberIds: t.recommendedEmployeeIds || [],
              leadMemberId: t.recommendedEmployeeIds?.[0] || null,
              burnoutWarning: t.burnoutWarning || false,
              reasoning: t.recommendationReasoning || "",
              assignmentException: t.assignmentException,
              teamComposition: t.teamComposition,
              budgetDecision: t.budgetDecision || "missing",
              budgetNoCostReason: t.budgetNoCostReason,
              budgetLines: normalizeImportedTaskBudgetLines(taskKey, t.budgetLines),
              enabled: true,
            });
          });
        });
      });
    });
    return out;
  };

  const reviewedSnapshot = useMemo(() => pdfPhase === 'review' ? buildCollaborationSnapshot({
    title: draftTasks[0]?.proposalTitle || pdfFileName.replace(/\.pdf$/i, '') || 'Imported Proposal',
    tasks: draftTasks, organizations: collaborationOrganizations, ownerOrgId: departmentFilter,
    planningAnchor: planningAnchor.current, budget: buildProposalBudgetFromTasks(draftTasks),
  }) : null, [pdfPhase, draftTasks, pdfFileName, collaborationOrganizations, departmentFilter]);
  const estimateIssue = draftTasks.find(task => task.enabled && taskEstimateError(task.estimatedHours));
  const persistence = useProposalDraftPersistence(`${userProfile?.id || ''}:${ownerOrgId}`, draftId, reviewedSnapshot, pdfPhase === 'review', estimateIssue ? `${estimateIssue.title}: ${taskEstimateError(estimateIssue.estimatedHours)}` : '');
  const handlePdfFile = async (file: File) => {
    if (importPending.current || committing) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("Please upload a PDF file.");
      setPdfPhase("error"); importPending.current = false;
      return;
    }
    importPending.current = true;
    setPdfFileName(file.name);
    setDraftId(null);
    setAutoSaveState("idle");

    planningAnchor.current = Date.now();
    setPdfFile(file); setPersistenceUncertain(false);
    setPdfError("");
    setAiQueueStatus(null);
    setDecompositionProgress(null);
    setDraftTasks([]);
    setCommitMessage("");
    setPdfPhase("extracting");

    let text: string; let savingDraft = false;
    try {
      text = await extractTextFromPdf(file);
      if (!text.trim()) {
        setPdfError("Could not extract text from PDF. It may be image-based.");
        setPdfPhase("error"); importPending.current = false;
        return;
      }
    } catch {
      setPdfError("Failed to read PDF file.");
      setPdfPhase("error"); importPending.current = false;
      return;
    }

    try {
      setPdfPhase("validating");
      const validation = await validateProposalDocument(text, file.name);
      if (!validation.is_proposal) {
        setPdfError(`${validation.message} Validation score: ${validation.score}%.`);
        setPdfPhase("error"); importPending.current = false;
        return;
      }
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? `Could not validate this proposal: ${error.message}`
          : "Could not validate this proposal.",
      );
      setPdfPhase("error"); importPending.current = false;
      return;
    }

    setPdfPhase("decomposing");
    try {
      const mentioned = detectMentionedOrganizations(text, orgs).filter((org) => org.id !== ownerOrgId);
      const detectedScope: CollaborationOrganizationSelection[] = [
        { orgId: ownerOrgId, participationRole: "owner", staffingEnabled: true },
        ...mentioned.map((org) => ({
          orgId: org.id,
          participationRole: defaultParticipationRole(org),
          staffingEnabled: defaultParticipationRole(org) !== "governance",
        } as CollaborationOrganizationSelection)),
      ];
      setCollaborationOrganizations(detectedScope);
      const expandedPool = getCollaborationCandidateEmployees(candidateEmployees, detectedScope);
      const candidates = expandedPool.length > 0
        ? filterEmployeesByPdfMentions(text, expandedPool, orgs)
        : employeesForAi;
      const result = await decomposeProposal(
        text,
        file.name.replace(/\.pdf$/i, ""),
        candidates,
        employeeNotes,
        (current, total, partTitle) =>
          setDecompositionProgress({ current, total, partTitle }),
        setAiQueueStatus,
      );
      const generatedTasks = buildDraftTasks(result, file.name.replace(/\.pdf$/i, ""));
      const snapshot = buildCollaborationSnapshot({
        title: generatedTasks[0]?.proposalTitle || file.name.replace(/\.pdf$/i, ""),
        tasks: generatedTasks,
        organizations: detectedScope,
        ownerOrgId: departmentFilter,
        planningAnchor: planningAnchor.current,
        budget: buildProposalBudgetFromTasks(generatedTasks),
      });
      setDraftTasks(generatedTasks); savingDraft = true;
      setAutoSaveState("saving");
      setPdfPhase("saving");
      const persistedDraft = await createCollaborationDraft({
        title: snapshot.title,
        ownerOrgId: departmentFilter,
        sourceType: "ai_pdf",
        snapshot,
        sourceFile: file,
      });
      persistence.markSaved(snapshot);
      setDraftId(persistedDraft.id);
      setDraftTasks(generatedTasks);
      setCommitMessage("Draft saved automatically.");
      setAutoSaveState("saved");
      setPdfPhase("review");
      importPending.current = false;
      setAiQueueStatus(null);
    } catch (error) {
      setAiQueueStatus(null);
      setPdfError(
        savingDraft ? "Draft persistence could not be confirmed. Check existing Drafts before starting another import; the result needs verification." : error instanceof Error
          ? `AI decomposition failed: ${error.message}`
          : "AI decomposition failed. Please try again.",
      );
      setPersistenceUncertain(savingDraft); setPdfPhase("error"); importPending.current = false;
    }
  };

  const handleDraftUpdate = (key: string, patch: Partial<DraftTask>) =>
    setDraftTasks((prev) =>
      prev.map((task) => (task.key === key ? { ...task, ...patch } : task)),
    );

  const handleDraftDelete = (key: string) =>
    setDraftTasks((prev) => prev.filter((task) => task.key !== key));

  const handleDraftAdd = (
    programIdx: number,
    projectIdx: number,
    activityIdx: number,
  ) => {
    const sibling = draftTasks.find(
      (task) =>
        task.programIdx === programIdx &&
        task.projectIdx === projectIdx &&
        task.activityIdx === activityIdx,
    );
    const proposalTitle =
      sibling?.proposalTitle ||
      pdfFileName.replace(/\.pdf$/i, "") ||
      "Imported Proposal";
    const programTitle = sibling?.programTitle || "Program";
    const projectTitle = sibling?.projectTitle || "Project";
    const activityTitle = sibling?.activityTitle || "Activity";
    const hierarchyIds = buildHierarchyIds(
      proposalTitle,
      programTitle,
      projectTitle,
      activityTitle,
      programIdx,
      projectIdx,
      activityIdx,
    );
    const newKey = `${programIdx}-${projectIdx}-${activityIdx}-${Date.now()}`;

    setDraftTasks((prev) => [
      ...prev,
      {
        key: newKey,
        proposalTitle,
        proposalId: sibling?.proposalId || hierarchyIds.proposalId,
        programIdx,
        projectIdx,
        activityIdx,
        taskIdx: Date.now(),
        programId: sibling?.programId || hierarchyIds.programId,
        programTitle,
        projectId: sibling?.projectId || hierarchyIds.projectId,
        projectTitle,
        activityId: sibling?.activityId || hierarchyIds.activityId,
        activityTitle,
        activitySchedule: sibling?.activitySchedule || "",
        title: "New Task",
        description: "",
        deadline: "",
        priority: "medium",
        requiredSkills: [],
        assignedMemberIds: [],
        leadMemberId: null,
        burnoutWarning: false,
        reasoning: "",
        assignmentException: undefined,
        teamComposition: undefined,
        budgetDecision: "missing",
        budgetLines: [],
        enabled: true,
      },
    ]);
  };

  const handleCommit = async () => {
    if (importPending.current) return;
    const toCreate = draftTasks.filter((task) => task.enabled);
    if (toCreate.length === 0) return;
    const invalidEstimate = toCreate.find((task) => taskEstimateError(task.estimatedHours));
    if (invalidEstimate) { setCommitMessage(`${invalidEstimate.title}: ${taskEstimateError(invalidEstimate.estimatedHours)}`); return; }
    importPending.current = true;
    setCommitting(true);
    setCommitMessage("Saving persistent collaboration draft...");
    try {
      const snapshot = buildCollaborationSnapshot({
        title: toCreate[0]?.proposalTitle || pdfFileName.replace(/\.pdf$/i, ""),
        tasks: draftTasks,
        organizations: collaborationOrganizations,
        ownerOrgId: departmentFilter,
        planningAnchor: planningAnchor.current,
        budget: buildProposalBudgetFromTasks(draftTasks),
      });
      if (draftId) await persistence.persist(draftId, snapshot);
      else await createCollaborationDraft({ title: snapshot.title, ownerOrgId: departmentFilter, sourceType: "ai_pdf", snapshot, sourceFile: pdfFile || undefined });
      setCommitMessage("Draft saved. No operational work was created.");
      toast("Proposal draft saved. Review collaboration scope before requesting approval.", "success");
      onClose?.();
    } catch (error) {
      setCommitMessage(error instanceof Error ? error.message : "Could not save the proposal draft.");
      toast("Could not save the collaboration draft.", "error");
    } finally {
      importPending.current = false;
      setCommitting(false);
    }
  };

  return {
    allEmployees,
    orgs,
    collaborationOrganizations,
    setCollaborationOrganizations,
    employeeNotes,
    deptEmployees,
    pdfFileRef,
    pdfPhase,
    setPdfPhase,
    pdfFileName,
    setPdfFileName,
    pdfError, persistenceUncertain,
    retryAnalysis: () => { if (pdfFile && !persistenceUncertain) void handlePdfFile(pdfFile); },
    setPdfError,
    aiQueueStatus,
    decompositionProgress,
    draftTasks,
    setDraftTasks,
    committing,
    autoSaveState: pdfPhase === 'review' ? persistence.state : autoSaveState,
    autoSaveError: persistence.error,
    draftDirty: persistence.dirty || pdfPhase === 'error' && draftTasks.length > 0,
    autosavePending: persistence.pending,
    retryAutosave: () => persistence.persist(),
    discardReview: () => { const saved = persistence.savedSnapshot(); if (saved) { setDraftTasks(saved.tasks as DraftTask[]); setCollaborationOrganizations(saved.organizations); } else setDraftTasks([]); },
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
  };
}
