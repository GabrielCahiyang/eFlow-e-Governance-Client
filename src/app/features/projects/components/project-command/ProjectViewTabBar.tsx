import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Tab, TabList, TabsContext } from "@vibe/core";
import {
  Activity,
  Add,
  Board,
  Calendar,
  Chart,
  CheckList,
  CloseSmall,
  CreditCard,
  Dashboard,
  Description,
  DropdownChevronDown,
  Folder,
  Security,
  Table,
  Team,
  Timeline,
  Versioning,
} from "@vibe/icons";
import type {
  OptionalProjectView,
  PermanentProjectView,
  ProjectCommandTab,
  ProjectViewMeta,
} from "./types";

export const PERMANENT_TABS: { id: PermanentProjectView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "timeline", label: "Timeline" },
  { id: "calendar", label: "Calendar" },
];

export const OPTIONAL_VIEWS_CATALOG: ProjectViewMeta[] = [
  // Project
  {
    id: "reports",
    label: "Reports",
    category: "Project",
    description: "Exportable data registers, progress tables, and CSV/PDF summaries.",
  },
  {
    id: "proposal_context",
    label: "Proposal Context",
    category: "Project",
    description: "Originating work plan, participating offices, and revision history.",
    requiresProposal: true,
  },
  {
    id: "activity",
    label: "Activity",
    category: "Project",
    description: "Chronological human-readable audit trail of all project events.",
  },
  {
    id: "reviews",
    label: "Reviews",
    category: "Project",
    description: "Task and subtask evidence reviews scoped to this project.",
  },

  // Insights
  {
    id: "dashboard",
    label: "Project Dashboard",
    category: "Insights",
    description: "Modular productivity widgets: delivery progress, blockers, and bottlenecks.",
  },
  {
    id: "workload",
    label: "Workload & Team",
    category: "Insights",
    description: "Team member allocation, deliverable ownership, and delivery health.",
  },
  {
    id: "budget",
    label: "Budget Overview",
    category: "Insights",
    description: "Allocated funds, line items, petty cash, and receipts.",
    requiresBudget: true,
  },

  // Governance
  {
    id: "signoff",
    label: "Approval Status",
    category: "Governance",
    description: "Office endorsement matrix, approval status, and approval quorum.",
  },
  {
    id: "evidence",
    label: "Evidence Register",
    category: "Governance",
    description: "Directory of uploaded work artifacts, attachments, and completions.",
  },
  {
    id: "decisions",
    label: "Decision History",
    category: "Governance",
    description: "Formal change requests, approval notes, and milestone decisions.",
  },
];

const VIEW_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  overview: Dashboard,
  tasks: Board,
  timeline: Timeline,
  calendar: Calendar,
  reports: Table,
  proposal_context: Description,
  activity: Activity,
  reviews: CheckList,
  dashboard: Chart,
  workload: Team,
  budget: CreditCard,
  signoff: Security,
  evidence: CheckList,
  decisions: Versioning,
};

export interface ProjectViewTabBarProps {
  projectId: string;
  activeTab: ProjectCommandTab;
  onSelectTab: (tab: ProjectCommandTab) => void;
  hasProposalContext?: boolean;
  hasBudgetData?: boolean;
}

export function ProjectViewTabBar({
  projectId,
  activeTab,
  onSelectTab,
  hasProposalContext = false,
  hasBudgetData = false,
}: ProjectViewTabBarProps) {
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const addViewMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Load persisted optional views for this project
  const storageKey = `eflow_project_views_${projectId}`;
  const [openViews, setOpenViews] = useState<OptionalProjectView[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((id) =>
            OPTIONAL_VIEWS_CATALOG.some((v) => v.id === id),
          );
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Persist optional views on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(openViews));
    } catch {
      // ignore
    }
  }, [openViews, storageKey]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addViewMenuRef.current && !addViewMenuRef.current.contains(e.target as Node)) {
        setAddViewOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenView = (viewId: OptionalProjectView) => {
    if (!openViews.includes(viewId)) {
      setOpenViews((curr) => [...curr, viewId]);
    }
    onSelectTab(viewId);
    setAddViewOpen(false);
  };

  const handleCloseView = (e: React.MouseEvent, viewId: OptionalProjectView) => {
    e.stopPropagation();
    const nextViews = openViews.filter((id) => id !== viewId);
    setOpenViews(nextViews);

    if (activeTab === viewId) {
      const closedIndex = openViews.indexOf(viewId);
      if (closedIndex > 0) {
        onSelectTab(openViews[closedIndex - 1]);
      } else {
        onSelectTab("overview");
      }
    }
  };

  // Filter available views in + Add view
  const availableViews = useMemo(() => {
    return OPTIONAL_VIEWS_CATALOG.filter((meta) => {
      if (meta.requiresProposal && !hasProposalContext) return false;
      if (meta.requiresBudget && !hasBudgetData) return false;
      return true;
    });
  }, [hasBudgetData, hasProposalContext]);

  // Group available views by category
  const viewsByCategory = useMemo(() => {
    const groups: Record<string, ProjectViewMeta[]> = {
      Project: [],
      Insights: [],
      Governance: [],
    };
    availableViews.forEach((v) => {
      groups[v.category]?.push(v);
    });
    return groups;
  }, [availableViews]);

  // Handle overflow: display up to 4 optional views on main bar; others into More
  const maxVisibleOptionalViews = 4;
  const visibleOptionalViews = openViews.slice(0, maxVisibleOptionalViews);
  const overflowOptionalViews = openViews.slice(maxVisibleOptionalViews);
  const isOverflowActive = overflowOptionalViews.includes(activeTab as OptionalProjectView);

  const tabItems = useMemo(() => {
    const core = PERMANENT_TABS.map((tab) => (
      <Tab
        key={tab.id}
        id={tab.id}
        active={activeTab === tab.id}
        onClick={() => onSelectTab(tab.id)}
      >
        {tab.label}
      </Tab>
    ));

    const optional = visibleOptionalViews
      .map((viewId) => {
        const meta = OPTIONAL_VIEWS_CATALOG.find((v) => v.id === viewId);
        if (!meta) return null;
        const isActive = activeTab === viewId;

        return (
          <Tab
            key={viewId}
            id={viewId}
            active={isActive}
            onClick={() => onSelectTab(viewId)}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{meta.label}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleCloseView(e, viewId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCloseView(e as any, viewId);
                  }
                }}
                title={`Close ${meta.label}`}
                className="inline-flex items-center justify-center p-0.5 rounded hover:bg-black/10 text-neutral-400 hover:text-neutral-700 transition-colors ml-0.5"
              >
                <CloseSmall size={12} />
              </span>
            </span>
          </Tab>
        );
      })
      .filter((item): item is React.ReactElement => Boolean(item));

    return [...core, ...optional];
  }, [activeTab, onSelectTab, visibleOptionalViews]);

  const allCurrentTabIds = useMemo(
    () => [...PERMANENT_TABS.map((t) => t.id), ...visibleOptionalViews],
    [visibleOptionalViews],
  );
  const activeTabIndex = allCurrentTabIds.indexOf(activeTab as any);

  return (
    <div className="eflow-workspace-tabs relative flex items-center w-full">
      {/* The tab scroller reserves a dedicated action lane so adding views can
          never cover a tab or its overflow menu. */}
      <div className="eflow-workspace-tabs__scroller flex items-center min-w-0 max-w-full">
        <TabsContext
          id={`project-workspace-tabs-${projectId}`}
          activeTabId={activeTabIndex >= 0 ? activeTabIndex : 0}
          className="min-w-0"
        >
          <TabList id={`project-workspace-tab-list-${projectId}`}>
            {tabItems}
          </TabList>
        </TabsContext>

      </div>

      {/* Fixed action lane: More and Add view stay outside the horizontal
          tab scroller so their menus cannot be clipped by overflow. */}
      <div className="eflow-workspace-tabs__actions relative shrink-0" ref={addViewMenuRef}>
        {/* Overflow Menu (More ▾) */}
        {overflowOptionalViews.length > 0 && (
          <div className="eflow-workspace-tabs__more relative shrink-0" ref={moreMenuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(!moreOpen)}
              className={`h-[37px] px-3 -mb-[1px] inline-flex items-center gap-1 text-[13px] font-medium rounded-t-[10px] transition-colors cursor-pointer border ${
                isOverflowActive
                  ? "bg-[#f4f4f4] text-[#181818] font-semibold border-[#d7d7d7] border-b-[#f4f4f4]"
                  : "bg-white text-neutral-600 hover:bg-[#f4f4f4] hover:text-[#202020] border-transparent"
              }`}
            >
              <span>More ({overflowOptionalViews.length})</span>
              <DropdownChevronDown size={13} className="text-neutral-400" />
            </button>

            {moreOpen && (
              <div role="menu" aria-label="More project views" className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-100 font-sans">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                  Open Project Views
                </div>
                {overflowOptionalViews.map((viewId) => {
                  const meta = OPTIONAL_VIEWS_CATALOG.find((v) => v.id === viewId);
                  if (!meta) return null;
                  const Icon = VIEW_ICONS[viewId] || Folder;
                  const isActive = activeTab === viewId;

                  return (
                    <div
                      key={viewId}
                      role="menuitem"
                      tabIndex={0}
                      onClick={() => {
                        onSelectTab(viewId);
                        setMoreOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectTab(viewId);
                          setMoreOpen(false);
                        }
                      }}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={isActive ? "text-primary" : "text-neutral-400"} />
                        <span>{meta.label}</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Close ${meta.label}`}
                        onClick={(e) => handleCloseView(e, viewId)}
                        className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60"
                      >
                        <CloseSmall size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* + Add view Button (Right-aligned) */}
        <Button
          kind="tertiary"
          size="small"
          leftIcon={Add}
          onClick={() => setAddViewOpen(!addViewOpen)}
        >
          Add view
        </Button>

        {addViewOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-80 rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-100 font-sans">
            <div className="p-2 border-b border-neutral-100 mb-1">
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                Workspace Views
              </h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Add full-canvas views to customize this project workspace.
              </p>
            </div>

            <div className="max-h-[380px] overflow-y-auto eflow-custom-scrollbar pr-1.5 space-y-3 p-1">
              {Object.entries(viewsByCategory).map(([category, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={category} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 pt-1">
                      {category}
                    </div>
                    {items.map((meta) => {
                      const Icon = VIEW_ICONS[meta.id] || Folder;
                      const isOpen = openViews.includes(meta.id);
                      return (
                        <button
                          key={meta.id}
                          type="button"
                          onClick={() => handleOpenView(meta.id)}
                          className="w-full text-left flex items-start gap-2.5 rounded-xl p-2 hover:bg-neutral-50 transition-colors cursor-pointer group"
                        >
                          <div className="p-1.5 rounded-lg bg-neutral-100 text-neutral-600 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors mt-0.5 shrink-0">
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-neutral-800 group-hover:text-indigo-900">
                                {meta.label}
                              </span>
                              {isOpen && (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  Open
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5 leading-tight">
                              {meta.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
