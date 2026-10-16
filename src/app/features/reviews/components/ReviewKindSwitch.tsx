import type { ReviewKind } from '../reviewView';
import { useLayoutEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
export type { ReviewKind } from '../reviewView';
import '../../../components/ui/workspace/localWorkflowTabs.css';

export interface ReviewKindSwitchProps {
  active: ReviewKind;
  onChange: (next: ReviewKind) => void;
  includeBudget?: boolean;
  includeMembership?: boolean;
  counts?: Partial<Record<ReviewKind, number>>;
}

export function ReviewKindSwitch({
  active,
  onChange,
  includeBudget = false,
  includeMembership = false,
  counts = {},
}: ReviewKindSwitchProps) {
  const kinds: { id: ReviewKind; label: string }[] = [
    { id: "workplans", label: "Work Plans" },
    { id: "tasks", label: "Project Tasks" },
    { id: "governance", label: "Governance & Approval" },
    { id: "subtasks", label: "Subtasks" },
    ...(includeBudget ? [{ id: "budget" as const, label: "Budget" }] : []),
    ...(includeMembership ? [{ id: "membership" as const, label: "Membership approvals" }] : []),
  ];
  const tabs = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = tabs.current;
    if (!container) return;
    const revealActive = () => {
      const selected = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!selected || !container.clientWidth) return;
      const box = container.getBoundingClientRect(), item = selected.getBoundingClientRect();
      if (item.left < box.left) container.scrollLeft += item.left - box.left;
      else if (item.right > box.right) container.scrollLeft += item.right - box.right;
    };
    revealActive();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(revealActive); observer.observe(container);
    return () => observer.disconnect();
  }, [active, includeBudget, includeMembership]);

  return (
    <div className="eflow-review-kind-switch min-w-0">
    <div className="eflow-review-kind-select">
      <Select value={active} onValueChange={value => { if (kinds.some(kind => kind.id === value)) onChange(value as ReviewKind); }}>
        <SelectTrigger aria-label="Review type"><SelectValue /></SelectTrigger>
        <SelectContent>{kinds.map(kind => <SelectItem className="min-h-[44px]" key={kind.id} value={kind.id}>{kind.label}{typeof counts[kind.id] === 'number' && counts[kind.id]! > 0 ? ` (${counts[kind.id]})` : ''}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div ref={tabs} className="eflow-review-kind-tabs eflow-local-workflow-tabs w-full">
      <TabsContext
        id="review-kind-tabs"
        activeTabId={kinds.findIndex((kind) => kind.id === active)}
      >
        <TabList id="review-kind-tab-list">
      {kinds.map((kind) => {
        const count = counts[kind.id];
        const isActive = active === kind.id;
        return (
          <Tab
            key={kind.id}
            id={`review-kind-${kind.id}`}
            active={isActive}
            onClick={() => onChange(kind.id)}
          >
            <span className="inline-flex items-center gap-1.5">{kind.label}
            {typeof count === "number" && count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            )}
            </span>
          </Tab>
        );
      })}
        </TabList>
      </TabsContext>
    </div>
    </div>
  );
}
import { Tab, TabList, TabsContext } from "@vibe/core";
