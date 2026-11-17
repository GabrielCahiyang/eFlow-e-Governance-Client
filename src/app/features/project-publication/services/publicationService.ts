import { supabase } from "../../../../lib/supabase";
import {
  AiServiceUnavailableError,
  ControlPanelUnavailableError,
  controlPanelFetch,
} from "../../../shared/controlPanelClient";
import type { ProjectSeal, SealStatus, SealConfiguration } from "../types";

export const PUBLICATION_SERVER_UNREACHABLE =
  "The blockchain publication server is unreachable right now. The secure tunnel may be restarting; try again in a moment.";
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
  // controlPanelFetch refreshes an expiring session token and re-reads the
  // published endpoint once when a Cloudflare Quick Tunnel has rotated, so a
  // restart of the tunnel no longer strands the Head on a dead address.
  let response: Response;
  try {
    response = await controlPanelFetch(
      `project-seals/${path}`,
      {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
      { timeoutMs: 110000 },
    );
  } catch (error) {
    if (
      error instanceof AiServiceUnavailableError ||
      error instanceof ControlPanelUnavailableError
    )
      throw new Error(PUBLICATION_SERVER_UNREACHABLE);
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error(
        "The publication server took too long to respond. Check the status and try again.",
      );
    throw error;
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : typeof data.error === "string"
          ? data.error
          : "";
    throw new Error(
      detail || "The publication server could not respond. Try again.",
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
