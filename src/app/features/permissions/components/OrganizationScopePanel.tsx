import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Plus, Trash2 } from "lucide-react";
import type { Organization } from "../../../types";
import { useToast } from "../../../components/ui/Toast";
import { ACCESS_LEVELS } from "../constants";
import { deleteOrganizationScopeGrant, fetchOrganizationScopeGrants, saveOrganizationScopeGrant } from "../services/permissionService";
import type { OrganizationAccessLevel, OrganizationScopeGrant } from "../types";

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
  const [accessLevel, setAccessLevel] = useState<OrganizationAccessLevel>("read");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const orgMap = useMemo(() => Object.fromEntries(organizations.map((org) => [org.id, org.name])), [organizations]);
  const available = organizations.filter((org) => org.is_active && org.id !== homeOrgId);

  const load = async () => {
    try { setGrants(await fetchOrganizationScopeGrants(userId)); }
    catch (error: any) { toast(error?.message || "Could not load organization grants.", "error"); }
  };
  useEffect(() => { void load(); }, [userId]);

  const save = async () => {
    if (!orgId) return toast("Choose an organization.", "warning");
    setSaving(true);
    try {
      await saveOrganizationScopeGrant({ userId, orgId, accessLevel, reason, expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null, grantedBy: actorId });
      setOrgId(""); setReason(""); setExpiresAt(""); setAccessLevel("read");
      await load();
      toast("Organization scope granted and audited.", "success");
    } catch (error: any) {
      toast(error?.message || "Failed to save the organization grant.", "error");
    } finally { setSaving(false); }
  };

  const remove = async (grantId: string) => {
    try { await deleteOrganizationScopeGrant(grantId); await load(); toast("Organization grant removed.", "success"); }
    catch (error: any) { toast(error?.message || "Failed to remove the grant.", "error"); }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-violet-50 p-2 text-violet-700"><Building2 size={17} /></div>
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-900">Organization scope exceptions</h3>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-neutral-500">A page permission does not expose another office. Add a separate, reasoned scope only when cross-office work requires it.</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl bg-neutral-50 p-3 lg:grid-cols-[1fr_120px_150px]">
        <select value={orgId} onChange={(event) => setOrgId(event.target.value)} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400">
          <option value="">Choose another organization…</option>
          {available.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value as OrganizationAccessLevel)} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400">
          {ACCESS_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </select>
        <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400" title="Optional expiry date" />
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required business reason…" className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] outline-none focus:border-neutral-400 lg:col-span-2" />
        <button type="button" disabled={saving} onClick={save} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[11px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"><Plus size={13} /> {saving ? "Saving…" : "Add scope"}</button>
      </div>

      <div className="mt-3 space-y-2">
        {grants.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-200 py-6 text-center text-[11px] text-neutral-400">No cross-organization exceptions. Normal role and organization scope applies.</p> : grants.map((grant) => (
          <div key={grant.id} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="text-[11.5px] font-semibold text-neutral-900">{orgMap[grant.orgId] || "Unknown organization"}</span><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-violet-700">{grant.accessLevel}</span></div>
              <p className="mt-1 truncate text-[10px] text-neutral-500">{grant.reason}</p>
            </div>
            {grant.expiresAt ? <span className="inline-flex items-center gap-1 text-[9.5px] text-neutral-400"><CalendarClock size={11} /> {new Date(grant.expiresAt).toLocaleDateString()}</span> : <span className="text-[9.5px] text-neutral-400">No expiry</span>}
            <button type="button" onClick={() => remove(grant.id)} className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Remove scope"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
