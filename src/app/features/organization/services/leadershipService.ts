import { supabase } from "../../../../lib/supabase";
import { refreshOrganizationDirectory } from "../../../../lib/supabaseService";

export interface OrganizationLeadershipInput {
  headUserId: string | null;
  assistantHeadUserId?: string | null;
}

export async function assignOrganizationLeadership(
  organizationId: string,
  leadership: OrganizationLeadershipInput,
): Promise<void> {
  if (leadership.assistantHeadUserId) throw new Error("Office leadership accepts only a Head.");

  const { error } = await supabase.rpc("set_organization_leadership", {
    p_org_id: organizationId,
    p_head_user_id: leadership.headUserId,
    p_assistant_head_user_id: null,
  });
  if (error) throw new Error(error.message);

  await refreshOrganizationDirectory();
}

export async function fetchOrganizationApprovers(organizationId: string): Promise<OrganizationLeadershipInput> {
  const { data, error } = await supabase.from("organization_memberships")
    .select("user_id,membership_role")
    .eq("organization_id", organizationId)
    .in("membership_role", ["primary_approver", "backup_approver"]);
  if (error) throw new Error(error.message);
  return {
    headUserId: data?.find((row) => row.membership_role === "primary_approver")?.user_id || null,
    assistantHeadUserId: data?.find((row) => row.membership_role === "backup_approver")?.user_id || null,
  };
}

export async function assignOrganizationApprovers(
  organizationId: string,
  leadership: OrganizationLeadershipInput,
): Promise<void> {
  if (leadership.headUserId && leadership.headUserId === leadership.assistantHeadUserId) {
    throw new Error("Primary and backup reviewers must be different people.");
  }
  const { error } = await supabase.rpc("set_organization_approvers", {
    p_organization_id: organizationId,
    p_primary_approver_id: leadership.headUserId,
    p_backup_approver_id: leadership.assistantHeadUserId,
  });
  if (error) throw new Error(error.message);
}
