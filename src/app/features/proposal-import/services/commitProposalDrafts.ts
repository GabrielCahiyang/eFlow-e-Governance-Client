import { isAdminRole } from "../../../shared/roles";
import type { Employee } from '../../../services/employeeService';
import { createProject, fetchMilestones } from '../../../services/projectService';
import { createTask, type CreateTaskPayload } from '../../../services/taskService';
import { supabase } from '../../../../lib/supabase';
import { resolveScheduleDateInput } from '../../../shared/scheduling/relativeSchedule';
import { slugifyFragment, type DraftTask } from '../components/draftModel';

interface CommitProposalDraftsInput {
  toCreate: DraftTask[];
  pdfFileName: string;
  departmentFilter: string;
  currentUserId: string;
  employeeById: Record<string, Employee>;
  planningSource?: "ai_pdf" | "manual";
  planningDescription?: string;
}

interface AuthenticatedCommitScope {
  userId: string;
  orgId: string | null;
}

/**
 * The draft editor can stay open while a user changes accounts or their
 * organization assignment is updated. Never use its cached profile values as
 * an authorization source for a write. Resolve the live Supabase session and
 * profile immediately before committing so projects and tasks use the exact
 * scope RLS will evaluate.
 */
async function resolveAuthenticatedCommitScope(
  _requestedOrgId: string,
): Promise<AuthenticatedCommitScope> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Your sign-in session has expired. Sign in again, then retry this work plan.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, org_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) {
    throw new Error("Your active eFlow profile could not be verified. Sign in again or ask an administrator to check your account.");
  }

  if (isAdminRole(profile.role)) throw new Error("Heads create office work. Admin manages accounts.");
  // Resolve the current office at the authenticated boundary.
  const scope = {
    userId: user.id,
    orgId: profile.org_id || null,
  };

  const { data: mayCreate, error: permissionError } = await supabase.rpc(
    "can_create_scoped_work",
    {
      target_org: scope.orgId,
      caller_id: scope.userId,
    },
  );
  if (permissionError) {
    throw new Error("The project-creation permission check could not run. Refresh the page and retry.");
  }
  if (!mayCreate) {
    throw new Error("Your current eFlow role is not allowed to create work in this office. Ask its Head to check your access.");
  }

  return scope;
}

function commitErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "The server did not provide a reason.";
}

export async function commitProposalDrafts({
  toCreate,
  pdfFileName,
  departmentFilter,
  employeeById,
  planningSource = "ai_pdf",
  planningDescription = "",
}: CommitProposalDraftsInput) {
  try {
    const writeScope = await resolveAuthenticatedCommitScope(departmentFilter);
  const batchPrefix =
      toCreate[0]?.proposalId ||
      `${planningSource === "manual" ? "manual-plan" : "proposal"}-${slugifyFragment(pdfFileName.replace(/\.pdf$/i, ""), planningSource === "manual" ? "manual" : "imported")}`;
    const importBatchId = `${batchPrefix}-${Date.now()}`;
    const planningAnchor = Date.now();
    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    // Group by the imported hierarchy id, not title alone. Two programs may
    // legitimately contain projects with the same display title.
    const projectGroups = new Map<
      string,
      {
        projectTitle: string;
        proposalTitle: string;
        proposalId: string;
        programId: string;
        programTitle: string;
        projectId: string;
        activities: Map<string, { activityTitle: string; schedule: string; tasks: typeof toCreate }>;
      }
    >();

    toCreate.forEach((dt) => {
      const projKey =
        dt.projectId ||
        `${dt.proposalId}:${dt.programId}:${dt.projectTitle.trim()}`;
      if (!projectGroups.has(projKey)) {
        projectGroups.set(projKey, {
          projectTitle: dt.projectTitle,
          proposalTitle: dt.proposalTitle,
          proposalId: dt.proposalId,
          programId: dt.programId,
          programTitle: dt.programTitle,
          projectId: dt.projectId,
          activities: new Map(),
        });
      }
      const projGroup = projectGroups.get(projKey)!;

      const actKey = dt.activityTitle.trim();
      if (!projGroup.activities.has(actKey)) {
        projGroup.activities.set(actKey, {
          activityTitle: dt.activityTitle,
          schedule: dt.activitySchedule || "",
          tasks: [],
        });
      }
      projGroup.activities.get(actKey)!.tasks.push(dt);
    });

    try {
      for (const projGroup of projectGroups.values()) {
        const milestonesInput = Array.from(projGroup.activities.values()).map((act) => {
          const dueDate = resolveScheduleDateInput(act.schedule, planningAnchor);
          return {
            title: act.activityTitle.trim(),
            dueDate,
            description: act.schedule ? `Original schedule: ${act.schedule}` : "",
          };
        });

        let dbProjectId = "";
        try {
          // Check for existing project to prevent duplicate imports
          const projectDescription = planningSource === "manual"
            ? planningDescription.trim() || `Manual plan: ${projGroup.proposalTitle}`
            : `Imported via proposal: ${projGroup.proposalTitle}`;
          let existingQuery = supabase
            .from("projects")
            .select("id")
            .eq("title", projGroup.projectTitle.trim())
            .eq("description", projectDescription)
            .is("archived_at", null);
          existingQuery = writeScope.orgId
            ? existingQuery.eq("org_id", writeScope.orgId)
            : existingQuery.is("org_id", null);
          const { data: existingProjs, error: existingError } =
            await existingQuery;
          if (existingError) throw existingError;

          if (existingProjs && existingProjs.length > 0) {
            dbProjectId = existingProjs[0].id;
          } else {
            const allMemberIds = new Set<string>();
            for (const act of projGroup.activities.values()) {
              for (const dt of act.tasks) {
                dt.assignedMemberIds.forEach((id) => {
                  if (id) allMemberIds.add(id);
                });
              }
            }

            const newProj = await createProject({
              title: projGroup.projectTitle.trim(),
              description: projectDescription,
              orgId: writeScope.orgId,
              // Preserve the public input for compatibility, but always use
              // the live authenticated user for a new project's owner record.
              ownerId: writeScope.userId,
              status: planningSource === "manual" ? "planning" : "active",
              priority: "medium",
              proposalId: projGroup.proposalId,
              proposalTitle: projGroup.proposalTitle,
              programId: projGroup.programId,
              programTitle: projGroup.programTitle,
              sourceType: planningSource,
              sourceFileName: planningSource === "ai_pdf" ? pdfFileName : null,
              milestones: milestonesInput,
              memberIds: Array.from(allMemberIds),
            });
            dbProjectId = newProj.id;
          }
        } catch (projErr) {
          console.error("Failed to create/resolve project:", projGroup.projectTitle, projErr);
          errors.push(`Project “${projGroup.projectTitle || "Untitled project"}”: ${commitErrorMessage(projErr)}`);
          // `project_id` is a legacy hierarchy string, not the UUID foreign key
          // used by operational projects. Never write it into linked_project_id.
          failed += Array.from(projGroup.activities.values()).reduce(
            (sum, activity) => sum + activity.tasks.length,
            0,
          );
          continue;
        }

        // Fetch milestone mapping
        let milestoneMap = new Map<string, string>();
        try {
          const dbMilestones = await fetchMilestones(dbProjectId);
          milestoneMap = new Map(dbMilestones.map((m) => [m.title.toLowerCase().trim(), m.id]));
        } catch (mErr) {
          console.error("Failed to fetch milestones for project:", dbProjectId, mErr);
        }

        // Create tasks for each activity
        for (const act of projGroup.activities.values()) {
          const dbMilestoneId = milestoneMap.get(act.activityTitle.toLowerCase().trim()) || "";

          for (const dt of act.tasks) {
            try {
              const selectedTeamMembers = dt.assignedMemberIds
                .map((id) => employeeById[id])
                .filter((member): member is Employee => Boolean(member));
              const leadMember =
                (dt.leadMemberId ? employeeById[dt.leadMemberId] : undefined) ||
                selectedTeamMembers[0];

              const payload: CreateTaskPayload = {
                title: dt.title,
                description: dt.description || "No description provided.",
                deadline:
                  resolveScheduleDateInput(
                    dt.deadline || dt.activitySchedule,
                    planningAnchor,
                  )
                  || dt.deadline
                  || "",
                priority: dt.priority,
                tags: dt.requiredSkills,
                status: leadMember?.id ? "todo" : "pending_assignment",
                department: writeScope.orgId || "",
                orgId: writeScope.orgId || undefined,
                teamId: writeScope.orgId || "",
                teamName:
                  leadMember?.departmentName ||
                  leadMember?.department ||
                  writeScope.orgId ||
                  "Imported",
                teamMemberIds: selectedTeamMembers.map((member) => member.id),
                teamMemberNames: selectedTeamMembers.map((member) => member.name),
                assigneeId: leadMember?.id,
                assigneeName: leadMember?.name,
                recommendedEmployeeIds: dt.assignedMemberIds,
                recommendationReasoning: dt.reasoning,
                ...(planningSource === "ai_pdf"
                  ? { recommendationSource: "import" as const }
                  : {}),
                recommendationLeadId: dt.leadMemberId || undefined,
                burnoutWarning: dt.burnoutWarning,
                proposalId: dt.proposalId,
                proposalTitle: dt.proposalTitle,
                programId: dt.programId,
                programTitle: dt.programTitle,
                projectId: dt.projectId,
                projectTitle: dt.projectTitle,
                activityId: dt.activityId,
                activityTitle: dt.activityTitle,
                activitySchedule: dt.activitySchedule,
                linkedProjectId: dbProjectId,
                milestoneId: dbMilestoneId,
                hierarchyPath: [
                  dt.proposalTitle,
                  dt.programTitle,
                  dt.projectTitle,
                  dt.activityTitle,
                ]
                  .filter(Boolean)
                  .join(" > "),
                importBatchId,
              };

              await createTask(payload);
              created++;
            } catch (err) {
              console.error("Failed to commit task from draft:", dt.title, err);
              errors.push(`Task “${dt.title || "Untitled task"}”: ${commitErrorMessage(err)}`);
              failed++;
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed during commit transaction:", err);
      errors.push(commitErrorMessage(err));
    }

  return { created, failed, errors: Array.from(new Set(errors)).slice(0, 8) };
  } catch (scopeError) {
    return {
      created: 0,
      failed: toCreate.filter((task) => task.enabled).length,
      errors: [commitErrorMessage(scopeError)],
    };
  }
}
