import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const featureDialog = readFileSync("src/app/components/ui/FeatureDialog.tsx", "utf8");
const dialog = readFileSync("src/app/components/ui/dialog.tsx", "utf8");

const migratedOverlays = [
  "src/app/features/budget/components/TaskBudgetDialog.tsx",
  "src/app/features/budget/components/AccountingTrailPanel.tsx",
  "src/app/features/tasks/components/board/task-chat/TaskChatSection.tsx",
  "src/app/features/work-templates/components/ProjectTemplatesModal.tsx",
].map((path) => [path, readFileSync(path, "utf8")] as const);

describe("accessible direct-overlay migration", () => {
  it("provides the shared dialog contract to feature-owned layouts", () => {
    expect(featureDialog).toContain("<Dialog open={open}");
    expect(featureDialog).toContain("onOpenChange={(nextOpen) => !nextOpen && !preventClose && onClose()}");
    expect(featureDialog).toContain("<DialogTitle");
    expect(featureDialog).toContain("<DialogDescription");
    expect(dialog).toContain("showCloseButton");
  });

  it("moves active task, budget, and template overlays to the shared dialog", () => {
    for (const [path, source] of migratedOverlays) {
      expect(source, path).toContain("FeatureDialog");
      expect(source, path).not.toContain("fixed inset-0");
      expect(source, path).not.toContain("fixed inset-y-0");
    }
  });
});
