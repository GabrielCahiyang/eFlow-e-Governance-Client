import { isAdminRole } from "../../../../shared/roles";
import { useState } from "react";
import { Button, IconButton } from "@vibe/core";
import { Close } from "@vibe/icons";
import * as Icons from "lucide-react";
import {
  publishAnnouncement,
  saveDraft,
  type Announcement,
  type AnnouncementDraft,
  type Audience,
} from "../../../../services/announcementService";
import { useOrgs } from "../../../../hooks/useSupabaseData";
import { useUsers } from "../../../../hooks/useFirebaseData";
import { useToast } from "../../../../components/ui/Toast";
import { InitialsAvatar } from "../../../../components/workflow/StatusBadges";
import { formatDate } from "../../../../components/workflow/primitives";
import { AUDIENCE_META } from "./announcementMeta";
import { InspectorPanel } from "../../../../shared/motion";

export function AnnouncementEditor({
  existing,
  onClose,
  onSaved,
}: {
  existing: Announcement | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { orgs } = useOrgs();
  const { users } = useUsers();
  const { toast } = useToast();
  const [title, setTitle] = useState(existing?.title || "");
  const [body, setBody] = useState(existing?.body || "");
  const [audience, setAudience] = useState<Audience>(existing?.audience || "all");
  const [orgId, setOrgId] = useState(existing?.orgId || "");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft: AnnouncementDraft = {
    title,
    body,
    audience,
    orgId: orgId || null,
    userIds,
    expiresAt: expiresAt || null,
  };

  const doSaveDraft = async () => {
    if (!title.trim()) {
      toast("Title is required.", "error");
      return;
    }
    setBusy(true);
    try {
      await saveDraft(draft, existing?.id);
      toast("Draft saved.", "success");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast(e?.message || "Failed to save draft.", "error");
    } finally {
      setBusy(false);
    }
  };

  const doPublish = async () => {
    if (!title.trim()) {
      toast("Title is required.", "error");
      return;
    }
    if (audience === "org" && !orgId) {
      toast("Choose a department for this audience.", "error");
      return;
    }
    if (audience === "users" && userIds.length === 0) {
      toast("Select at least one recipient.", "error");
      return;
    }
    setBusy(true);
    try {
      const id = existing?.id || (await saveDraft(draft));
      await publishAnnouncement(id, draft);
      toast("Announcement published to all recipients.", "success");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast(e?.message || "Failed to publish announcement.", "error");
    } finally {
      setBusy(false);
    }
  };

  const candidates = users.filter((u) => !isAdminRole(u.role));

  return (
      <InspectorPanel ariaLabel={existing ? "Edit announcement" : "Create announcement"} className="w-full sm:w-[580px]" layer={60} onClose={onClose} open>
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Icons.Megaphone size={18} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-neutral-900">
                {existing ? "Edit Announcement" : "Create New Announcement"}
              </h2>
              <p className="text-[11.5px] font-normal text-neutral-500">
                Draft official broadcast directives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button active={preview} kind="secondary" onClick={() => setPreview(!preview)} size="small"><Icons.Eye aria-hidden="true" size={13} /> {preview ? "Edit Form" : "Preview"}</Button>
            <IconButton aria-label="Close announcement editor" icon={Close} kind="tertiary" onClick={onClose} size="small" />
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {preview ? (
            <div className="space-y-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Recipient Live Preview
              </div>
              <div className="bg-gradient-to-br from-neutral-50 via-white to-neutral-50 border border-neutral-200/90 rounded-2xl p-6 shadow-sm">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-0.5 mb-3">
                  <Icons.Megaphone size={12} /> Announcement · {(AUDIENCE_META[audience] || AUDIENCE_META.all).label}
                </div>
                <h1 className="text-xl font-semibold text-neutral-900">
                  {title || "Untitled Announcement"}
                </h1>
                <div className="text-[13.5px] font-normal text-neutral-700 mt-3 whitespace-pre-wrap leading-relaxed">
                  {body || "No message body typed yet."}
                </div>
                {expiresAt && (
                  <div className="text-[11.5px] font-medium text-amber-600 mt-4 pt-3 border-t border-neutral-100 flex items-center gap-1">
                    <Icons.Clock size={12} /> Expiration date set for {formatDate(expiresAt)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Title Input */}
              <div>
                <label className="text-[12px] font-medium text-neutral-700 mb-1.5 flex items-center justify-between">
                  <span>Announcement Title <span className="text-red-500">*</span></span>
                  <span className="text-[10.5px] text-neutral-400 font-normal">{title.length}/100</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Executive Advisory: Office Hours Adjustment"
                  className={inputCls}
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="text-[12px] font-medium text-neutral-700 mb-1.5 block">
                  Announcement Message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Write official message guidelines or announcement content…"
                  className={`${inputCls} h-auto resize-none leading-relaxed py-2.5`}
                />
              </div>

              {/* Audience Cards Selector */}
              <div>
                <label className="text-[12px] font-medium text-neutral-700 mb-2 block">
                  Target Audience Scope
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(Object.keys(AUDIENCE_META) as Audience[]).map((a) => {
                    const isSelected = audience === a;
                    const meta = AUDIENCE_META[a];
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAudience(a)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                            : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
                        }`}
                      >
                        <div className="mb-1.5">{meta.icon}</div>
                        <div className="text-[11.5px] font-medium text-center leading-tight">
                          {a === "all" ? "Everyone" : a === "org" ? "Department" : "Selected Users"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audience Details Picker */}
              {audience === "org" && (
                <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-4 space-y-2">
                  <label className="text-[12px] font-medium text-blue-900 block">
                    Select Target Department (Includes Sub-units)
                  </label>
                  <select
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Choose a department…</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {audience === "users" && (
                <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 space-y-3">
                  <label className="text-[12px] font-medium text-purple-900 block">
                    Selected Recipient Personnel ({userIds.length})
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {userIds.map((id) => {
                      const u = users.find((x) => x.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 bg-white border border-purple-200 rounded-full pl-1.5 pr-2.5 py-1 text-[11.5px] font-medium shadow-2xs"
                        >
                          <InitialsAvatar name={u?.full_name} size={16} />
                          {u?.full_name?.split(" ")[0]}
                          <button
                            type="button"
                            onClick={() => setUserIds(userIds.filter((x) => x !== id))}
                            className="text-neutral-400 hover:text-red-600"
                          >
                            <Icons.X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !userIds.includes(e.target.value)) {
                        setUserIds([...userIds, e.target.value]);
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="">Add recipient user…</option>
                    {candidates
                      .filter((u) => !userIds.includes(u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Expiry Input */}
              <div>
                <label className="text-[12px] font-medium text-neutral-700 mb-1.5 block">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between gap-3">
          <Button disabled={busy} kind="secondary" onClick={doSaveDraft} size="small">Save Draft</Button>

          <Button disabled={busy} kind="primary" loading={busy} onClick={doPublish} size="small">
            <Icons.Send size={14} /> {busy ? "Publishing…" : "Publish Announcement"}
          </Button>
        </div>
      </InspectorPanel>
  );
}

const inputCls =
  "w-full h-10 px-3 bg-neutral-50/80 border border-neutral-200/80 rounded-xl text-[12.5px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white transition-all";
