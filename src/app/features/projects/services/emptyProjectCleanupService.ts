import { supabase } from "../../../../lib/supabase";
import { fetchProjectDeletionBlockers } from "./projectLifecycleService";
import { deleteProject } from "./projectMutationService";

export interface EmptyProjectCleanupCandidate {
  id: string;
  title: string;
}

export type EmptyProjectCleanupOutcome =
  | { status: "not_empty" }
  | { status: "kept"; project: EmptyProjectCleanupCandidate }
  | { status: "deleted"; project: EmptyProjectCleanupCandidate };

interface EmptyProjectCleanupDependencies {
  find: typeof findEmptyProjectCleanupCandidate;
  remove: typeof deleteEmptyProjectAfterTaskCleanup;
}

/** Offer cleanup only when the server confirms deletion is allowed. */
export async function findEmptyProjectCleanupCandidate(
  projectId: string,
): Promise<EmptyProjectCleanupCandidate | null> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) return null;

  const blockers = await fetchProjectDeletionBlockers(projectId);
  if (!blockers || blockers.length > 0) return null;

  return { id: project.id as string, title: project.title as string };
}

export async function deleteEmptyProjectAfterTaskCleanup(
  project: EmptyProjectCleanupCandidate,
): Promise<void> {
  await deleteProject(
    project.id,
    project.title,
    "Empty project removed after its final task was deleted from the Task Board.",
  );
}

export async function offerEmptyProjectCleanup(
  projectId: string,
  confirmDelete: (project: EmptyProjectCleanupCandidate) => boolean | Promise<boolean>,
  dependencies: EmptyProjectCleanupDependencies = {
    find: findEmptyProjectCleanupCandidate,
    remove: deleteEmptyProjectAfterTaskCleanup,
  },
): Promise<EmptyProjectCleanupOutcome> {
  const project = await dependencies.find(projectId);
  if (!project) return { status: "not_empty" };
  if (!await confirmDelete(project)) return { status: "kept", project };
  await dependencies.remove(project);
  return { status: "deleted", project };
}
