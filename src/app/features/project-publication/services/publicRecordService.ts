import { createClient } from "@supabase/supabase-js";
import type { ArchiveManifest, PublicCertificate } from "../types";

/** Dedicated anonymous client: never reuse the signed-in operational client. */
const reader = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
export async function loadPublicCertificate(
  id: string,
): Promise<PublicCertificate> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new Error("This certificate link is invalid.");
  const { data, error } = await reader
    .from("project_seal_certificates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Public project records are not available yet.");
  if (!data)
    throw new Error("No confirmed public certificate exists at this address.");
  return data as PublicCertificate;
}
export async function sha256(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function archiveAddress(uri: string) {
  if (/^ipfs:\/\/[a-zA-Z0-9]+\/manifest\.json$/.test(uri))
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  const url = new URL(uri),
    source = new URL(import.meta.env.VITE_SUPABASE_URL);
  if (
    url.origin !== source.origin ||
    !/^\/storage\/v1\/object\/public\/project-seal-public\/[a-f0-9]{64}\/manifest\.json$/.test(
      url.pathname,
    ) ||
    url.search ||
    url.hash
  )
    throw new Error("The archive location is invalid.");
  return url.href;
}
export async function loadPublicArchive(
  certificate: PublicCertificate,
): Promise<{ manifest: ArchiveManifest; text: string; url: string }> {
  const url = archiveAddress(certificate.archive_uri),
    response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw new Error(
      "The public archive is unavailable. Its blockchain fingerprint remains recorded.",
    );
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 20 * 1024 * 1024)
    throw new Error("The public archive is too large to display.");
  if ((await sha256(bytes)) !== certificate.manifest_hash)
    throw new Error(
      "The archive does not match its published fingerprint. Do not rely on this copy.",
    );
  const text = new TextDecoder().decode(bytes),
    manifest = JSON.parse(text) as ArchiveManifest;
  if (
    manifest.schema_version !== 1 ||
    manifest.snapshot_id !== certificate.id ||
    manifest.project_id !== certificate.project_id ||
    !Array.isArray(manifest.files) ||
    !manifest.records
  )
    throw new Error("The archive does not match this certificate.");
  return { manifest, text, url };
}
export async function publicFile(
  url: string,
  path: string,
  expected: string,
): Promise<Blob> {
  if (!/^files\/[a-f0-9]{64}$/.test(path) || path !== `files/${expected}`)
    throw new Error("This file path is invalid.");
  const response = await fetch(new URL(path, url), {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error("This project file is unavailable.");
  const bytes = await response.arrayBuffer();
  if ((await sha256(bytes)) !== expected)
    throw new Error("This file does not match its published fingerprint.");
  return new Blob([bytes], { type: "application/octet-stream" });
}
