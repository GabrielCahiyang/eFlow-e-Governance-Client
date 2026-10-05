import { useState } from "react";
import { Add, CloseSmall, DropdownChevronDown, Folder } from "@vibe/icons";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../../../../components/ui/dropdown-menu";
import { OPTIONAL_VIEWS_CATALOG, VIEW_ICONS } from "./projectViewCatalog";
import type { OptionalProjectView } from "./types";
import "./projectViewControls.css";

interface ProjectViewMenusProps {
  openViews: OptionalProjectView[];
  overflowViews: OptionalProjectView[];
  onOpenView: (id: OptionalProjectView) => void;
  onCloseView: (id: OptionalProjectView) => void;
  hasProposalContext: boolean;
  hasBudgetData: boolean;
}

export function ProjectViewMenus({ openViews, overflowViews, onOpenView, onCloseView, hasProposalContext, hasBudgetData }: ProjectViewMenusProps) {
  const [addViewOpen, setAddViewOpen] = useState(false);
  const availableViews = OPTIONAL_VIEWS_CATALOG.filter(view =>
    (!view.requiresProposal || hasProposalContext) && (!view.requiresBudget || hasBudgetData));

  return (
    <div className="eflow-workspace-tabs__actions shrink-0">
      {overflowViews.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-haspopup="menu" className="eflow-project-view-trigger">
              More ({overflowViews.length})<DropdownChevronDown size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="eflow-project-view-overflow" aria-label="More project views">
            <DropdownMenuLabel>Open project views</DropdownMenuLabel>
            {overflowViews.map(viewId => {
              const meta = OPTIONAL_VIEWS_CATALOG.find(view => view.id === viewId)!;
              const Icon = VIEW_ICONS[viewId] || Folder;
              return (
                <div key={viewId} className="eflow-project-view-overflow__row">
                  <DropdownMenuItem onSelect={() => onOpenView(viewId)}><Icon size={16} />{meta.label}</DropdownMenuItem>
                  <DropdownMenuItem aria-label={`Close ${meta.label}`} title={`Close ${meta.label}`} onSelect={() => onCloseView(viewId)}>
                    <CloseSmall size={16} />
                  </DropdownMenuItem>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Popover open={addViewOpen} onOpenChange={setAddViewOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="eflow-project-view-trigger"><Add size={18} />Add view</button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} collisionPadding={12} aria-label="Add project view" className="eflow-project-view-menu">
          <header>
            <h4>Workspace views</h4>
            <p>Choose a view for this project.</p>
          </header>
          {(["Project", "Insights", "Governance"] as const).map(category => {
            const items = availableViews.filter(view => view.category === category);
            return items.length > 0 && (
              <section key={category} aria-label={category}>
                <h5>{category}</h5>
                {items.map(meta => {
                  const Icon = VIEW_ICONS[meta.id] || Folder;
                  return (
                    <button key={meta.id} type="button" aria-label={meta.label} onClick={() => { onOpenView(meta.id); setAddViewOpen(false); }}>
                      <span className="eflow-project-view-menu__icon"><Icon size={18} /></span>
                      <span className="eflow-project-view-menu__copy">
                        <strong>{meta.label}</strong><span>{meta.description}</span>
                      </span>
                      {openViews.includes(meta.id) && <span className="eflow-project-view-menu__badge">Open</span>}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
