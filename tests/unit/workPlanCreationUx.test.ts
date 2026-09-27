import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const draftCockpit = readFileSync(
  "src/app/features/proposal-import/components/DraftCockpit.tsx",
  "utf8",
);
const creationStyles = readFileSync(
  "src/app/features/projects/components/projectsVibe.css",
  "utf8",
);
const manualPlanBuilder = readFileSync(
  "src/app/features/proposal-import/components/ManualPlanBuilder.tsx",
  "utf8",
);
const manualPlanController = readFileSync(
  "src/app/features/proposal-import/hooks/useManualPlanController.ts",
  "utf8",
);

describe("manual work-plan creation UX", () => {
  it("guides the hierarchy without the legacy dark summary bar", () => {
    expect(draftCockpit).toContain("Build the delivery hierarchy");
    expect(draftCockpit).toContain("Save work-plan draft");
    expect(draftCockpit).toContain("Saving this draft does not create operational work.");
    expect(draftCockpit).not.toContain("bg-gradient-to-br from-neutral-900 to-neutral-800");
  });

  it("uses clear, standard inputs for project and activity names", () => {
    expect(draftCockpit).toContain('placeholder="Name this project"');
    expect(draftCockpit).toContain('placeholder="Name this activity"');
    expect(draftCockpit).toContain("focus:border-ring focus:ring-2 focus:ring-ring/15");
    expect(draftCockpit).not.toContain("uppercase tracking-wide");
  });

  it("keeps the creation dialog focused instead of full-width", () => {
    expect(creationStyles).toContain("--modal-width: min(1100px, calc(100vw - 40px))");
  });

  it("keeps the first-program title prerequisite inside the dialog", () => {
    expect(manualPlanController).toContain('setPlanTitleError("Enter a plan title before adding a Program.")');
    expect(manualPlanController).not.toContain('toast("Name the plan before adding its first program.", "error")');
    expect(manualPlanBuilder).toContain('id="manual-plan-title-error"');
    expect(manualPlanBuilder).toContain("planTitleInputRef.current?.focus()");
  });

  it("uses field-level errors instead of an aggregate alert or external validation toast", () => {
    expect(manualPlanBuilder).not.toContain("Complete these items before creating the work plan");
    expect(manualPlanController).not.toContain('toast("This work plan is incomplete. Review the requirements below.", "error")');
    expect(manualPlanController).not.toContain('toast("The work-plan draft could not be saved.", "error")');
  });
});
