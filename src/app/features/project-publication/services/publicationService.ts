import { supabase } from "../../../../lib/supabase";
import { resolveControlPanelBase } from "../../../shared/controlPanelClient";
import type { ProjectSeal, SealStatus, SealConfiguration } from "../types";
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "Project sealing is not installed on this server yet."
        : error.message,
    );
  return data as T;
}
async function request(path: string, method = "GET", body?: unknown) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again to review this project.");
  const base = await resolveControlPanelBase();
  const response = await fetch(`${base}/project-seals/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(110000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The publication server could not respond. Try again.",
    );
  }
  return response;
}
export const loadSealStatus = (projectId: string) =>
  rpc<SealStatus>("project_seal_status", { p_project_id: projectId });
export const loadSealConfiguration = async () =>
  (await request("configuration")).json() as Promise<SealConfiguration>;
export const prepareSeal = async (projectId: string, correction?: string) =>
  (
    await request(`${projectId}/prepare`, "POST", {
      correction: correction || null,
    })
  ).json() as Promise<{ id: string; state: string }>;
export const loadSealPreview = (id: string) =>
  rpc<ProjectSeal>("seal_snapshot_preview", { p_snapshot_id: id });
export const approveSeal = (seal: ProjectSeal) =>
  rpc("approve_project_seal", {
    p_snapshot_id: seal.id,
    p_manifest_hash: seal.manifest_hash,
  });
export const discardSeal = (id: string) =>
  rpc("discard_project_seal", { p_snapshot_id: id });
export const retrySeal = (id: string) =>
  rpc("retry_project_seal", { p_snapshot_id: id });
export async function downloadPreviewFile(
  id: string,
  hash: string,
  name: string,
) {
  saveFile(await (await request(`snapshots/${id}/files/${hash}`)).blob(), name);
}
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function replacePublicationFile(
  id: string,
  originalHash: string,
  file: File,
  reason: string,
) {
  if (!file.size || file.size > 25 * 1024 * 1024)
    throw new Error("Choose a nonempty publication copy up to 25 MB.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again to review this project.");
  const path = `${id}/${session.user.id}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage
    .from("project-seal-copies")
    .upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
  if (error) throw new Error(error.message);
  return (
    await request(`snapshots/${id}/publication-copy`, "POST", {
      original_sha256: originalHash,
      copy_path: path,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      reason: reason.trim(),
    })
  ).json();
}
