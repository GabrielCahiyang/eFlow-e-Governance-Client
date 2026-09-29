import * as React from "react";
import { Button, Label, Tab, TabList, TabsContext } from "@vibe/core";
import { File } from "@vibe/icons";
import { FileText, GitCommitHorizontal, LayoutDashboard, MessageCircle, Shield, Users, WalletCards } from "lucide-react";
import type { Organization } from "../../../types";
import { COLLABORATION_STATUS_LABELS } from "../constants";
import { getCollaborationSourceUrl } from "../services/collaborationDraftService";
import type {
  CollaborationDraft,
  CollaborationDraftSnapshot,
  CollaborationRevision,
} from "../types";
import { SourcePdfPreviewDialog } from "./SourcePdfPreviewDialog";

export type CollaborationWorkspaceTab =
  | "overview"
  | "board"
  | "source"
  | "plan"
  | "budget"
  | "people"
  | "discussion"
  | "changes"
  | "approvals"
  | "governance"
  | "revisions";

/** Primary tabs always shown in the main tab bar */
const PRIMARY_TABS: Array<{ id: CollaborationWorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Work plan" },
  { id: "discussion", label: "Collaboration" },
  { id: "approvals", label: "Review & Governance" },
];

/** Secondary tabs shown as icon buttons — contextual / audit-related */
const SECONDARY_TABS: Array<{
  id: CollaborationWorkspaceTab;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "source",
    label: "Source PDF",
    icon: <FileText size={15} />,
  },
  {
    id: "people",
    label: "Team roster",
    icon: <Users size={15} />,
  },
  {
    id: "budget",
    label: "Budget",
    icon: <WalletCards size={15} />,
  },
  {
    id: "changes",
    label: "Requested changes",
    icon: <MessageCircle size={15} />,
  },
  {
    id: "governance",
    label: "Governance",
    icon: <Shield size={15} />,
  },
  {
    id: "revisions",
    label: "Plan update history",
    icon: <GitCommitHorizontal size={15} />,
  },
];

export function CollaborationWorkspaceHeader({
  draft,
  snapshot,
  currentRevision,
  owner,
  participantCount,
  openChangeCount,
  tab,
  primaryTab,
  secondaryTab,
  onTabChange,
  onSecondaryTabChange,
  readyToPublish,
  deliveryLabel,
  showDeliveryBoard = false,
  departmentOnly = false,
}: {
  draft: CollaborationDraft;
  snapshot: CollaborationDraftSnapshot;
  currentRevision?: CollaborationRevision;
  owner?: Organization;
  participantCount: number;
  openChangeCount: number;
  tab: CollaborationWorkspaceTab;
  primaryTab?: "overview" | "plan" | "discussion" | "approvals";
  secondaryTab?: CollaborationWorkspaceTab | null;
  onTabChange: (tab: CollaborationWorkspaceTab) => void;
  onSecondaryTabChange?: (tab: CollaborationWorkspaceTab | null) => void;
  onBack?: () => void;
  readyToPublish?: boolean;
  deliveryLabel?: string;
  showDeliveryBoard?: boolean;
  departmentOnly?: boolean;
}) {
  const [pdfPreviewUrl, setPdfPreviewUrl] = React.useState<string | null>(null);
  const isCommitted = ["committed", "archived"].includes(draft.status);
  const status =
    isCommitted && deliveryLabel
      ? deliveryLabel
      : readyToPublish && !isCommitted
        ? "Ready to publish"
        : COLLABORATION_STATUS_LABELS[draft.status];

  const statusColor =
    draft.status === "changes_requested"
      ? "negative"
      : readyToPublish ||
          draft.status === "ready_to_commit" ||
          draft.status === "committed"
        ? "positive"
        : "primary";

  /** Which primary tabs are visible */
  const visiblePrimary = PRIMARY_TABS.map((item) => item.id === "plan" && isCommitted ? { ...item, label: "Project tasks" } : item).filter((item) => {
    if (departmentOnly && (item.id !== "approvals" && item.id !== "governance" ? false : true))
      return false;
    return true;
  });
  const primaryTabs = showDeliveryBoard
    ? [...visiblePrimary, { id: "board" as CollaborationWorkspaceTab, label: "Board" }]
    : visiblePrimary;

  /** Which secondary tabs are visible */
  const visibleSecondary = SECONDARY_TABS.filter((item) => {
    if (departmentOnly && item.id === "governance") return false;
    return true;
  });

  const isSecondaryActive = Boolean(secondaryTab && visibleSecondary.some((s) => s.id === secondaryTab));
  const primaryActive = primaryTab || (tab === "overview"
    ? "overview"
    : ["plan", "board"].includes(tab)
      ? "plan"
      : ["discussion", "people"].includes(tab)
        ? "discussion"
        : "approvals");

  const handleOpenPdf = async () => {
    if (!draft.sourceFilePath) return;
    try {
      const url = await getCollaborationSourceUrl(draft.sourceFilePath);
      setPdfPreviewUrl(url);
    } catch {
      // Handled silently
    }
  };

  return (
    <>
      {/* Persistent centered navigation sits directly beneath the global shell. */}
      <div className="eflow-workspace-tabs eflow-collaboration-primary-tabs">
        <TabsContext
          id={`collaboration-tabs-${draft.id}`}
          activeTabId={Math.max(0, primaryTabs.findIndex((item) => item.id === (tab === "board" ? "board" : primaryActive)))}
          className="min-w-0"
        >
          <TabList id={`collaboration-tab-list-${draft.id}`}>
            {primaryTabs.map((item) => (
              <Tab
                key={item.id}
                id={`collaboration-${draft.id}-${item.id}`}
                active={item.id === "board" ? tab === "board" : tab !== "board" && primaryActive === item.id}
                onClick={() => onTabChange(item.id)}
              >
                {item.label}
              </Tab>
            ))}
          </TabList>
        </TabsContext>
      </div>

      {tab === "overview" && <header className="eflow-section-card p-5">
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs text-neutral-600">
              {draft.sourceType === "ai_pdf"
                ? "Imported from document"
                : "Custom work plan"}{" "}
              · Version {currentRevision?.revisionNumber || 1}
            </span>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">
              {draft.title}
            </h1>
            <p className="m-0 mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <span>
                Lead:{" "}
                <strong className="font-semibold text-neutral-800">
                  {owner?.name || "Organization unavailable"}
                </strong>
              </span>
              <span>·</span>
              <span>
                {snapshot.tasks.filter((task) => task.enabled).length}{" "}
                {isCommitted ? "published" : "proposed"} tasks
              </span>
              <span>·</span>
              <span>
                {participantCount}{" "}
                {participantCount === 1 ? "organization" : "organizations"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {draft.sourceFilePath && (
              <Button
                kind="tertiary"
                size="small"
                leftIcon={File}
                onClick={() => void handleOpenPdf()}
              >
                Source document
              </Button>
            )}
            <Label text={status} color={statusColor} />
          </div>
        </div>

        {/* Secondary icon rail — contextual / audit panels */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Workspace tools</span>
          <div className="flex min-w-0 basis-full flex-wrap items-center gap-0.5 sm:basis-auto">
            {visibleSecondary.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={secondaryTab === item.id}
                onClick={() => onSecondaryTabChange?.(secondaryTab === item.id ? null : item.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  secondaryTab === item.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                }`}
              >
                <span className="relative">
                  {item.icon}
                  {item.id === "changes" && openChangeCount > 0 && (
                    <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
                      {openChangeCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary tab label breadcrumb — only when a secondary tab is active */}
        {isSecondaryActive && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-neutral-100 pt-3">
            <LayoutDashboard size={13} className="text-neutral-400" />
            <span className="text-xs text-neutral-600">
              {visibleSecondary.find((s) => s.id === secondaryTab)?.label}
            </span>
            <button
              type="button"
              onClick={() => onSecondaryTabChange?.(null)}
              className="ml-auto text-xs font-medium text-blue-600 hover:underline"
            >
              ← Back to overview
            </button>
          </div>
        )}
      </header>}

      {/* Keep secondary context reachable when its panel is active. The
          primary tab remains selected so returning to the project workspace
          does not reset the user's place. */}
      {tab !== "overview" && isSecondaryActive && (
        <div className="eflow-collaboration-secondary-context mt-3 flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <LayoutDashboard size={13} className="text-neutral-400" />
            <span>{visibleSecondary.find((s) => s.id === secondaryTab)?.label}</span>
          </div>
          <button
            type="button"
            onClick={() => onSecondaryTabChange?.(null)}
            className="ml-auto text-xs font-medium text-blue-600 hover:underline"
          >
            Close tool
          </button>
        </div>
      )}

      {/* PDF Modal Dialog */}
      {pdfPreviewUrl && (
        <SourcePdfPreviewDialog
          title={draft.title}
          url={pdfPreviewUrl}
          onClose={() => setPdfPreviewUrl(null)}
        />
      )}
    </>
  );
}
