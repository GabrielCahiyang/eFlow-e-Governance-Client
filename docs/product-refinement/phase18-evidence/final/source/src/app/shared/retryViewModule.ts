import type { ComponentType } from "react";

/** Retry code from the current build with a fresh module URL, never cached user data. */
export async function retryViewModule(
  name: string,
): Promise<{ default: ComponentType<any> }> {
  const manifestUrl = new URL(
    `${import.meta.env.BASE_URL}eflow-view-modules.json`,
    location.origin,
  );
  const response = await fetch(manifestUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("View download unavailable.");
  const manifest: Record<string, unknown> = await response.json();
  const file = manifest[name];
  if (typeof file !== "string" || !/^assets\/[\w-]+\.js$/.test(file))
    throw new Error("View download unavailable.");
  const url = new URL(file, manifestUrl);
  url.searchParams.set("eflow-retry", crypto.randomUUID());
  const module = await import(/* @vite-ignore */ url.href);
  if (typeof module[name] !== "function" && typeof module[name] !== "object")
    throw new Error("View download unavailable.");
  return { default: module[name] };
}
