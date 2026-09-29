import { useMemo, useState } from "react";
import { Dropdown, Search as VibeSearch } from "@vibe/core";
import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useOrgs, useScopedOrgIds } from "../../../hooks/useSupabaseData";
import { useCollaborationDrafts, isActiveCollaborationDraft } from "../../interdepartment-collaboration";
import { queueNotificationNavigationIntent } from "../../notifications";
import { SectionEmpty } from "../../../components/workflow/primitives";
import { WorkspaceLoadingSkeleton } from "../../../components/workflow/WorkspaceLoadingSkeleton";

const governanceSortOptions = [
  { value: "newest", label: "Newest updated" },
  { value: "oldest", label: "Oldest pending" },
];

function timeAgo(ts?: number): string {
  if (!ts) return "recently";
  const h = Math.floor((Date.now() - ts) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function GovernanceReviewInbox({ onNavigate }: { onNavigate?: (section: string, page: string) => void }) {
  const { userProfile } = useAuth();
  const { isSuperAdmin } = useScopedOrgIds();
  const { orgs } = useOrgs();
  const collaboration = useCollaborationDrafts();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");

  const currentOrgId = userProfile?.org_id || userProfile?.departmentId || "";
  const accessibleOrgIds = useMemo(
    () => new Set([currentOrgId, ...collaboration.membershipOrgIds].filter(Boolean)),
    [collaboration.membershipOrgIds, currentOrgId],
  );

  const orgMap = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);

  const governanceDrafts = useMemo(() => {
    let rows = collaboration.drafts
      .filter(isActiveCollaborationDraft)
      .filter((draft) =>
        ["in_review", "ready_to_commit"].includes(draft.status) &&
        (isSuperAdmin ||
          draft.ownerOrgId === currentOrgId ||
          draft.snapshot.organizations.some(
            (item) => item.participationRole === "governance" && accessibleOrgIds.has(item.orgId),
          )),
      );

    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (d) =>
          (d.title || "").toLowerCase().includes(q) ||
          (d.snapshot?.description || "").toLowerCase().includes(q) ||
          (orgMap.get(d.ownerOrgId) || "").toLowerCase().includes(q),
      );
    }

    rows.sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      return sort === "oldest" ? timeA - timeB : timeB - timeA;
    });

    return rows;
  }, [accessibleOrgIds, collaboration.drafts, currentOrgId, isSuperAdmin, orgMap, query, sort]);

  const handleOpenGovernance = (draftId: string) => {
    queueNotificationNavigationIntent({
      notificationId: `gov-draft-${draftId}-${Date.now()}`,
      kind: "collaboration",
      proposalId: draftId,
    });
    if (onNavigate) {
      onNavigate("projects", "Projects");
    } else {
      window.dispatchEvent(
        new CustomEvent("eflow:navigate", {
          detail: { section: "projects", page: "Projects" },
        }),
      );
    }
  };

  if (collaboration.loading) {
    return (
      <div className="p-8">
        <WorkspaceLoadingSkeleton label="Loading governance & approval items…" rows={4} />
      </div>
    );
  }

  return (
    <div className="eflow-operational-workspace space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs">
        <VibeSearch
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search governance items, approvals, approval decisions…"
          inputAriaLabel="Search governance reviews"
          showClearIcon
          size="small"
          className="flex-1 max-w-md"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">Sort:</span>
          <Dropdown
            aria-label="Sort governance reviews"
            className="w-[170px]"
            clearable={false}
            value={governanceSortOptions.find((option) => option.value === sort)}
            onChange={(option) => setSort(String(option.value))}
            options={governanceSortOptions}
            size="small"
          />
        </div>
      </div>

      {governanceDrafts.length === 0 ? (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-12 text-center shadow-xs">
          <SectionEmpty
            icon={<CheckCircle2 size={36} className="text-emerald-500" />}
            title="Governance queue clear"
            description="No governance decisions or formal approval items require your action at this time."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {governanceDrafts.map((draft) => {
            const ownerOrgName = orgMap.get(draft.ownerOrgId) || "Lead Department";
            const governanceOrgCount = draft.snapshot.organizations.filter((o) => o.participationRole === "governance").length;

            return (
              <div
                key={draft.id}
                className="bg-white border border-neutral-200/80 hover:border-purple-300 rounded-2xl p-5 shadow-xs transition-all hover:shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-50 border border-purple-100 text-purple-700 text-[10.5px] font-bold uppercase tracking-wider">
                      <ShieldCheck size={12} /> Governance / Approval
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-purple-200 bg-purple-50/50 text-[11px] font-semibold text-purple-800">
                      {draft.status === "ready_to_commit" ? "Ready to Commit" : "Approval In Progress"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                      <Clock size={12} /> Updated {timeAgo(draft.updatedAt || draft.createdAt)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                      {draft.title || "Untitled Governance Item"}
                    </h3>
                    {draft.snapshot?.description && (
                      <p className="text-xs text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
                        {draft.snapshot.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap pt-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Building2 size={13} className="text-neutral-400" />
                      <span>Owner: <strong className="text-neutral-700 font-semibold">{ownerOrgName}</strong></span>
                    </span>
                    {governanceOrgCount > 0 && (
                      <span className="text-neutral-500 font-medium">
                        {governanceOrgCount} department{governanceOrgCount === 1 ? "" : "s"} in governance review
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenGovernance(draft.id)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Approval &amp; Governance</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
