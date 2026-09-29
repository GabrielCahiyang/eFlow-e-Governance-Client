export type ReviewKind = "tasks" | "workplans" | "governance" | "subtasks" | "budget";

export interface ReviewKindSwitchProps {
  active: ReviewKind;
  onChange: (next: ReviewKind) => void;
  includeBudget?: boolean;
  counts?: Partial<Record<ReviewKind, number>>;
}

export function ReviewKindSwitch({
  active,
  onChange,
  includeBudget = false,
  counts = {},
}: ReviewKindSwitchProps) {
  const kinds: { id: ReviewKind; label: string }[] = [
    { id: "workplans", label: "Work Plans" },
    { id: "tasks", label: "Project Tasks" },
    { id: "governance", label: "Governance & Approval" },
    { id: "subtasks", label: "Subtasks" },
    ...(includeBudget ? [{ id: "budget" as const, label: "Budget" }] : []),
  ];

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto">
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
              <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-70 motion-reduce:animate-none" />
                <span className="relative h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)]" />
              </span>
            )}
            {typeof count === "number" && count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-neutral-200/80 text-neutral-600"
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
  );
}
import { Tab, TabList, TabsContext } from "@vibe/core";
