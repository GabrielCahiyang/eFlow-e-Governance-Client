import { useEffect, useRef, useState } from "react";
import { Tab, TabList, TabsContext } from "@vibe/core";
import { CloseSmall } from "@vibe/icons";
import { ProjectViewMenus } from "./ProjectViewMenus";
import { OPTIONAL_VIEWS_CATALOG, PERMANENT_TABS, resolveProjectView } from "./projectViewCatalog";
import { useWorkspaceScope } from '../../../workspaces';
import type { OptionalProjectView, ProjectCommandTab } from "./types";

export { OPTIONAL_VIEWS_CATALOG, PERMANENT_TABS } from "./projectViewCatalog";

export interface ProjectViewTabBarProps {
  projectId: string;
  activeTab: ProjectCommandTab;
  onSelectTab: (tab: ProjectCommandTab) => void;
  hasProposalContext?: boolean;
  hasBudgetData?: boolean;
}

function loadOpenViews(projectId: string, key: string): OptionalProjectView[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || localStorage.getItem(`eflow_project_views_${projectId}`) || "[]");
    return Array.isArray(parsed)
      ? [...new Set<OptionalProjectView>(parsed.filter(id => OPTIONAL_VIEWS_CATALOG.some(view => view.id === id)))]
      : [];
  } catch {
    return [];
  }
}

export function ProjectViewTabBar({
  projectId, activeTab: requestedTab, onSelectTab, hasProposalContext = false, hasBudgetData = false,
}: ProjectViewTabBarProps) {
  const scope = useWorkspaceScope();
  const key = `eflow_project_views_${projectId}` + (scope ? `:${scope.userId}:${scope.workspace.id}` : '');
  const activeTab = resolveProjectView(requestedTab) || 'tasks';
  const [savedViews, setSavedViews] = useState(() => ({ key, views: loadOpenViews(projectId,key) }));
  const tabBarRef = useRef<HTMLDivElement>(null);
  const focusAfterClose = useRef(false);
  const storedViews = savedViews.key === key ? savedViews.views : loadOpenViews(projectId,key);
  const activeOptional = OPTIONAL_VIEWS_CATALOG.find(view => view.id === activeTab)?.id;
  // Shortcuts and direct URLs must expose the selected view in the same tab bar.
  const openViews = activeOptional && !storedViews.includes(activeOptional)
    ? [...storedViews, activeOptional] : storedViews;
  const viewSignature = openViews.join(",");

  useEffect(() => {
    const views = viewSignature ? viewSignature.split(",") as OptionalProjectView[] : [];
    setSavedViews(current => current.key === key && current.views.join(",") === viewSignature
      ? current : { key, views });
    try {
      localStorage.setItem(key, JSON.stringify(views));
    } catch {
      // View preferences remain usable when browser storage is unavailable.
    }
  }, [key, viewSignature]);

  useEffect(() => {
    if (focusAfterClose.current) {
      tabBarRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
      focusAfterClose.current = false;
    }
  }, [activeTab, viewSignature]);

  const closeView = (viewId: OptionalProjectView) => {
    setSavedViews({ key, views: openViews.filter(id => id !== viewId) });
    if (activeTab === viewId) {
      focusAfterClose.current = true;
      const index = openViews.indexOf(viewId);
      onSelectTab(index > 0 ? openViews[index - 1] : "tasks");
    }
  };

  // Keep the active view visible even when it was opened from the overflow menu.
  const visibleOptionalViews = openViews.slice(0, 4);
  if (activeOptional && !visibleOptionalViews.includes(activeOptional)) {
    visibleOptionalViews[3] = activeOptional;
  }
  const overflowOptionalViews = openViews.filter(id => !visibleOptionalViews.includes(id));
  const allTabIds: ProjectCommandTab[] = [...PERMANENT_TABS.map(tab => tab.id), ...visibleOptionalViews];
  const activeTabIndex = allTabIds.indexOf(activeTab);

  return (
    <div ref={tabBarRef} className="eflow-workspace-tabs relative flex items-center w-full">
      <div className="eflow-workspace-tabs__scroller flex items-center min-w-0 max-w-full">
        <TabsContext id={`project-workspace-tabs-${projectId}`} activeTabId={Math.max(0, activeTabIndex)} className="min-w-0">
          <TabList id={`project-workspace-tab-list-${projectId}`}>
            {[...PERMANENT_TABS.map(tab => (
              <Tab key={tab.id} id={tab.id} active={activeTab === tab.id} onClick={() => onSelectTab(tab.id)}>
                {tab.label}
              </Tab>
            )), ...visibleOptionalViews.map(viewId => {
              const meta = OPTIONAL_VIEWS_CATALOG.find(view => view.id === viewId)!;
              return (
                <Tab key={viewId} id={viewId} active={activeTab === viewId} onClick={() => onSelectTab(viewId)}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{meta.label}</span>
                    <span role="button" tabIndex={0} title={`Close ${meta.label}`}
                      onClick={event => { event.stopPropagation(); closeView(viewId); }}
                      onKeyDownCapture={event => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault(); event.stopPropagation(); closeView(viewId);
                        }
                      }}
                      className="inline-flex items-center justify-center p-0.5 rounded hover:bg-black/10 text-neutral-400 hover:text-neutral-700 ml-0.5">
                      <CloseSmall size={12} />
                    </span>
                  </span>
                </Tab>
              );
            })]}
          </TabList>
        </TabsContext>
      </div>
      {/* Fixed action lane; menus render in portals outside every scrolling ancestor. */}
      <ProjectViewMenus openViews={openViews} overflowViews={overflowOptionalViews} onOpenView={viewId => {
        if (OPTIONAL_VIEWS_CATALOG.some(view => view.id === viewId)) {
          const optionalId = viewId as OptionalProjectView;
          setSavedViews({ key, views: openViews.includes(optionalId) ? openViews : [...openViews, optionalId] });
        }
        onSelectTab(viewId);
      }} onCloseView={closeView} hasProposalContext={hasProposalContext} hasBudgetData={hasBudgetData} />
    </div>
  );
}
