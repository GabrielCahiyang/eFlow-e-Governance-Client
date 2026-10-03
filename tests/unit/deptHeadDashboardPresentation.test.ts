import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync("src/app/components/Head/HeadDashboard.tsx", "utf8");
const taskRow = readFileSync("src/app/components/Head/HeadDashboardTaskRow.tsx", "utf8");

describe("office head command center presentation", () => {
  it("uses a responsive command-center shell and skeleton loading state", () => {
    expect(dashboard).toContain("max-w-[1480px]");
    expect(dashboard).toContain("bg-gradient-to-br from-primary/5 via-card to-card");
    expect(dashboard).toContain("function HeadDashboardSkeleton()");
    expect(dashboard).toContain('aria-live="polite"');
  });

  it("keeps dashboard status and task rows on semantic design tokens", () => {
    expect(dashboard).toContain("No overdue tasks");
    expect(dashboard).toContain("border-border/70");
    expect(dashboard).toContain("hover:bg-accent/60");
    expect(taskRow).toContain("text-foreground");
    expect(taskRow).toContain("text-muted-foreground");
    expect(taskRow).not.toContain("text-neutral-900");
  });
});
