import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { DateInput } from "../../../components/ui/DateInput";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarClock, Plus, Trash2 } from "lucide-react";
import type { Organization } from "../../../types";
import { useToast } from "../../../components/ui/Toast";
import { ACCESS_LEVELS } from "../constants";
import {
  deleteOrganizationScopeGrant,
  fetchOrganizationScopeGrants,
  saveOrganizationScopeGrant,
} from "../services/permissionService";
import type { OrganizationAccessLevel, OrganizationScopeGrant } from "../types";

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { readableUiError } from "../../../shared/userFacingError";

const accessLabel = (value: OrganizationAccessLevel) =>
  ({ read: 'View records', review: 'View and review assigned work', manage: 'Manage projects and tasks' }[value]);
export function OrganizationScopePanel({
  userId,
  homeOrgId,
  actorId,
  organizations,
}: {
  userId: string;
  homeOrgId: string | null;
  actorId: string;
  organizations: Organization[];
}) {
  const { toast } = useToast();
  const [grants, setGrants] = useState<OrganizationScopeGrant[]>([]);
  const [orgId, setOrgId] = useState("");
  const [accessLevel, setAccessLevel] =
    useState<OrganizationAccessLevel>("read");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [failure, setFailure] = useState("");
  const [result, setResult] = useState("");
  const confirmation = useConfirmation();
  const reset = () => {
    setOrgId("");
    setReason("");
    setExpiresAt("");
    setAccessLevel("read");
  };
  const draft = useExplicitDraft(
    "Office access change",
    Boolean(orgId || reason || expiresAt || accessLevel !== "read"),
    saving,
    reset,
  );
  const orgMap = useMemo(
    () => Object.fromEntries(organizations.map((org) => [org.id, org.name])),
    [organizations],
  );
  const available = organizations.filter(
    (org) => org.is_active && org.id !== homeOrgId,
  );

  const load = async () => {
    try {
      setGrants(await fetchOrganizationScopeGrants(userId));
    } catch (error: any) {
      toast(readableUiError(error, "We couldn’t load this person’s Office access.", 'read'), "error");
    }
  };
  useEffect(() => {
    void load();
  }, [userId]);

  const save = async () => {
    if (pending.current) return;
    if (!reason.trim()) return setFailure("Enter a reason for granting access.");
    if (!orgId) return toast("Choose an Office.", "warning");
    pending.current = true;
    draft.pendingRef.current = true;
    setSaving(true);
    setFailure("");
    try {
      if (
        !(await confirmation.confirm({
          title: "Grant Office access?",
          description: `Grant access to ${orgMap[orgId] || "the selected Office"}. Access level: ${accessLabel(accessLevel)}. ${expiresAt ? "Expires " + expiresAt : "No expiry date"}. Reason: ${reason}. Their page permissions still apply.`,
          actionLabel: "Grant Office access",
        }))
      )
        return;
      await saveOrganizationScopeGrant({
        userId,
        orgId,
        accessLevel,
        reason,
        expiresAt: expiresAt
          ? new Date(`${expiresAt}T23:59:59`).toISOString()
          : null,
        grantedBy: actorId,
      });
      draft.markClean();
      reset();
      setResult(`Granted access to ${orgMap[orgId] || "the selected Office"}.`);
      await load();
      toast("Office access granted.", "success");
    } catch (error) {
      setFailure(readableUiError(error, "We couldn’t grant Office access. Check the person’s current access before trying again."));
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async (grantId: string) => {
    if (pending.current) return;
    const grant = grants.find((item) => item.id === grantId);
    if (!grant) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setSaving(true);
    try {
      if (
        !(await confirmation.confirm({
          title: "Remove Office access?",
          description: `Remove the additional access to ${orgMap[grant.orgId] || "this Office"}. Access level: ${accessLabel(grant.accessLevel)}. The person keeps access provided by their role and home Office.`,
          actionLabel: "Remove Office access",
          danger: true,
        }))
      )
        return;
      await deleteOrganizationScopeGrant(grantId);
      setResult("Office access removed.");
      await load();
      toast("Office access removed.", "success");
    } catch (error) {
      setFailure(readableUiError(error, "We couldn’t remove Office access. Check the person’s current access before trying again."));
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      {confirmation.dialog}
      {failure && (
        <FeedbackState tone="error" title="Check Office access">
          {failure}
        </FeedbackState>
      )}
      {result && (
        <FeedbackState tone="success" title="Office access updated">
          {result}
        </FeedbackState>
      )}
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-violet-50 p-2 text-violet-700">
          <Building2 size={17} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-900">
            Access to other Offices
          </h3>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-neutral-500">
            Use this to give someone access to another Office’s records. Their page permissions still apply.
          </p>
        </div>
      </div>

      <fieldset
        disabled={saving}
        className="grid gap-2 rounded-xl bg-neutral-50 p-3 lg:grid-cols-[1fr_120px_150px]"
      >
        <select
          aria-label="Office to grant access to"
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400"
        >
          <option value="">Choose another Office…</option>
          {available.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Office access level"
          value={accessLevel}
          onChange={(event) =>
            setAccessLevel(event.target.value as OrganizationAccessLevel)
          }
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400"
        >
          {ACCESS_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {accessLabel(level.value)}
            </option>
          ))}
        </select>
        <DateInput
          aria-label="Access expiry date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400"
          title="Optional expiry date"
        />
        <input
          aria-label="Reason for granting Office access"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Enter a reason…"
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400 lg:col-span-2"
        />
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[11px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          <Plus size={13} /> {saving ? "Saving…" : "Grant Office access"}
        </button>
      </fieldset>

      <div className="mt-3 space-y-2">
        {grants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 py-6 text-center text-[11px] text-neutral-400">
            This person has no additional Office access.
          </p>
        ) : (
          grants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11.5px] font-semibold text-neutral-900">
                    {orgMap[grant.orgId] || "Office name unavailable"}
                  </span>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-violet-700">
                    {accessLabel(grant.accessLevel)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[10px] text-neutral-500">
                  {grant.reason}
                </p>
              </div>
              {grant.expiresAt ? (
                <span className="inline-flex items-center gap-1 text-[9.5px] text-neutral-400">
                  <CalendarClock size={11} />{" "}
                  {new Date(grant.expiresAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                </span>
              ) : (
                <span className="text-[9.5px] text-neutral-400">No expiry date</span>
              )}
              <WorkspaceTooltip content={`Remove Office access for ${orgMap[grant.orgId] || "this Office"}`}><button
                type="button"
                disabled={saving}
                aria-label={`Remove Office access for ${orgMap[grant.orgId] || "this Office"}`}
                onClick={() => remove(grant.id)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"

              >
                <Trash2 size={14} />
              </button></WorkspaceTooltip>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
