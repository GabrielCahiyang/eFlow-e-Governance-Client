import { useMemo, useState } from "react";
import { Dropdown, Search as VibeSearch } from "@vibe/core";
import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Users,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useOrgs } from "../../../hooks/useSupabaseData";
import { useCollaborationDrafts, isActiveCollaborationDraft } from "../../interdepartment-collaboration";
import { queueNotificationNavigationIntent } from "../../notifications";
import { SectionEmpty } from "../../../components/workflow/primitives";

const workPlanSortOptions = [
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

function WorkPlanCardsSkeleton() {
  const pulse = "animate-pulse rounded bg-neutral-200/80";
  return (
    <div
      className="grid grid-cols-1 gap-4"
      role="status"
      aria-label="Loading incoming work plan reviews…"
      aria-busy="true"
    >
      <span className="sr-only">Loading incoming work plan reviews…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5"
        >
          <div className="space-y-2.5 min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`h-5 w-32 rounded-md ${pulse}`} />
              <span className={`h-5 w-28 rounded-full ${pulse}`} />
              <span className={`h-3.5 w-24 ${pulse}`} />
            </div>
            <div className="space-y-1.5">
              <span className={`block h-5 w-2/5 ${pulse}`} />
              <span className={`block h-3.5 w-4/5 ${pulse}`} />
            </div>
            <div className="flex items-center gap-4 pt-1">
              <span className={`h-3.5 w-40 ${pulse}`} />
              <span className={`h-3.5 w-48 ${pulse}`} />
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
            <span className={`h-9 w-40 rounded-xl ${pulse}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkPlanReviewInbox({ onNavigate }: { onNavigate?: (section: string, page: string) => void }) {
  const { user,userProfile } = useAuth();
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

  const incomingDrafts = useMemo(() => {
    let rows = collaboration.drafts
      .filter(isActiveCollaborationDraft)
      .filter(
        (draft) =>
          ["in_review", "changes_requested", "ready_to_commit"].includes(draft.status) &&
          draft.snapshot.organizations.some(
            (org) => org.participationRole !== "owner" && accessibleOrgIds.has(org.orgId),
          ),
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
  }, [accessibleOrgIds, collaboration.drafts, orgMap, query, sort]);

  const handleOpenReview = (draftId: string) => {
    queueNotificationNavigationIntent({
      notificationId: `review-draft-${draftId}-${Date.now()}`,
      kind: "collaboration",
      proposalId: draftId,
    },user?.id);
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

  return (
    <div className="eflow-operational-workspace space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs">
        <VibeSearch
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search work plans, proposals, requesting offices…"
          inputAriaLabel="Search work plan reviews"
          showClearIcon
          size="small"
          className="flex-1 max-w-md"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">Sort:</span>
          <Dropdown
            aria-label="Sort work plan reviews"
            className="w-[170px]"
            clearable={false}
            value={workPlanSortOptions.find((option) => option.value === sort)}
            onChange={(option) => setSort(String(option.value))}
            options={workPlanSortOptions}
            size="small"
          />
        </div>
      </div>

      {collaboration.loading ? (
        <WorkPlanCardsSkeleton />
      ) : incomingDrafts.length === 0 ? (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-12 text-center shadow-xs">
          <SectionEmpty fill illustration="complete"
            icon={<CheckCircle2 size={36} className="text-emerald-500" />}
            title="All work plans reviewed"
            description="No incoming collaborative proposals or work plans currently require your office's decision."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {incomingDrafts.map((draft) => {
            const ownerOrgName = orgMap.get(draft.ownerOrgId) || "Partner Office";
            const participatingOrgs = draft.snapshot.organizations
              .filter((o) => o.orgId !== draft.ownerOrgId)
              .map((o) => orgMap.get(o.orgId) || o.orgId);

            const statusBadge =
              draft.status === "in_review"
                ? { label: "Needs Decision", bg: "bg-amber-50 text-amber-700 border-amber-200" }
                : draft.status === "changes_requested"
                  ? { label: "Changes Requested", bg: "bg-rose-50 text-rose-700 border-rose-200" }
                  : { label: "Ready to Commit", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };

            return (
              <div
                key={draft.id}
                className="bg-white border border-neutral-200/80 hover:border-indigo-300 rounded-2xl p-5 shadow-xs transition-all hover:shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10.5px] font-bold uppercase tracking-wider">
                      <FileCheck2 size={12} /> Work Plan Review
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusBadge.bg}`}>
                      {statusBadge.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                      <Clock size={12} /> Updated {timeAgo(draft.updatedAt || draft.createdAt)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                      {draft.title || "Untitled Work Plan"}
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
                    {participatingOrgs.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users size={13} className="text-neutral-400" />
                        <span>Involved: {participatingOrgs.join(", ")}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenReview(draft.id)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Review &amp; Governance</span>
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
