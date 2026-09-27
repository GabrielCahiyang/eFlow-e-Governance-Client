import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const featureDialog = readFileSync("src/app/components/ui/FeatureDialog.tsx", "utf8");
const dialog = readFileSync("src/app/components/ui/dialog.tsx", "utf8");

const migratedOverlays = [
  "src/app/features/budget/components/TaskBudgetDialog.tsx",
  "src/app/features/budget/components/AccountingTrailPanel.tsx",
  "src/app/features/tasks/components/board/task-chat/TaskChatSection.tsx",
  "src/app/features/role-legislative/session/components/AgendaControls.tsx",
  "src/app/features/role-legislative/session/components/AdjournmentControls.tsx",
  "src/app/features/role-legislative/session/components/AgendaItemDrawer.tsx",
  "src/app/features/role-legislative/session/components/SessionBroadcast.tsx",
  "src/app/features/work-templates/components/ProjectTemplatesModal.tsx",
  "src/app/features/work-templates/components/SubtaskTemplateEditor.tsx",
  "src/app/features/work-templates/components/SubtaskTemplateApplyDialog.tsx",
  "src/app/features/role-hrmo/components/DepartmentRiskFlags.tsx",
  "src/app/features/role-hrmo/components/WellnessInterventions.tsx",
].map((path) => [path, readFileSync(path, "utf8")] as const);

describe("accessible direct-overlay migration", () => {
  it("provides the shared dialog contract to feature-owned layouts", () => {
    expect(featureDialog).toContain("<Dialog open={open}");
    expect(featureDialog).toContain("onOpenChange={(nextOpen) => !nextOpen && onClose()}");
    expect(featureDialog).toContain("<DialogTitle");
    expect(featureDialog).toContain("<DialogDescription");
    expect(dialog).toContain("showCloseButton");
  });

  it("moves the first-priority task, budget, legislative, template, and HRMO overlays to the shared dialog", () => {
    for (const [path, source] of migratedOverlays) {
      expect(source, path).toContain("FeatureDialog");
      expect(source, path).not.toContain("fixed inset-0");
      expect(source, path).not.toContain("fixed inset-y-0");
    }
  });

  it("keeps explicit confirmation for the destructive legislative adjournment action", () => {
    const adjournmentControls = readFileSync(
      "src/app/features/role-legislative/session/components/AdjournmentControls.tsx",
      "utf8",
    );

    expect(adjournmentControls).toContain('typedText.toUpperCase() === "ADJOURN"');
  });
});
