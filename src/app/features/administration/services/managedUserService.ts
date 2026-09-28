import { refreshProfiles } from "../../../../lib/supabaseService";
import { controlPanelFetch } from "../../../shared/controlPanelClient";

export async function deleteManagedUser(userId: string): Promise<void> {
  const response = await controlPanelFetch(
    `admin/users/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
    { retryOnEndpointChange: true },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(payload.detail || "Failed to delete this account.");
  }

  await refreshProfiles();
}
