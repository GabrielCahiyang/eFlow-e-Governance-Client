import * as React from "react";
import { Save } from "lucide-react";
import type { Organization } from "../../../types";
import type { CollaborationDraftSnapshot } from "../types";
import { OrganizationScopePicker } from "./OrganizationScopePicker";

export function OrganizationParticipantsPanel({ snapshot, ownerOrgId, organizations, editable, onSave }: {
  snapshot: CollaborationDraftSnapshot;
  ownerOrgId: string;
  organizations: Organization[];
  editable: boolean;
  onSave: (snapshot: CollaborationDraftSnapshot) => Promise<void>;
}) {
  const [value, setValue] = React.useState(snapshot.organizations);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => setValue(snapshot.organizations), [snapshot]);
  if (!editable) return null;
  const dirty = JSON.stringify(value) !== JSON.stringify(snapshot.organizations);
  return <div className="space-y-2">{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<OrganizationScopePicker organizations={organizations} value={value} ownerOrgId={ownerOrgId} onChange={setValue} footer={<div className="eflow-collaboration-scope__save flex justify-end"><button type="button" disabled={!dirty || saving} onClick={async () => { setSaving(true); setError(""); try { await onSave({ ...snapshot, organizations: value }); } catch (failure) { setError(failure instanceof Error ? failure.message : "Changes could not be saved."); } finally { setSaving(false); } }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[11px] font-medium text-white disabled:opacity-40"><Save size={13} />{saving ? "Saving…" : "Save office changes"}</button></div>} /></div>;
}
