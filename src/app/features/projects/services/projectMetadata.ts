import { supabase } from "../../../../lib/supabase";
import { rowToProject } from "./projectMappers";
import type { Project } from "./types";

export class ProjectMetadataConflict extends Error {
  constructor() {
    super("Project updated elsewhere; review new values before saving.");
    this.name = "ProjectMetadataConflict";
  }
}

/** Strict read: errors and revoked access must never turn into an empty editable record. */
export async function fetchProjectMetadata(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.id !== id)
    throw new Error("Project unavailable or access removed.");
  return rowToProject(data);
}
