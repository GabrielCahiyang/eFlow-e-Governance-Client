import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manualBuilder = readFileSync("src/app/features/proposal-import/components/ManualPlanBuilder.tsx", "utf8");
const settingsProfile = readFileSync("src/app/features/settings/components/ProfileSettingsPage.tsx", "utf8");
const taskHierarchy = readFileSync("src/app/features/tasks/components/board/HierarchyTaskRow.tsx", "utf8");
const projectViewControls = readFileSync("src/app/features/projects/components/project-command/projectViewControls.css", "utf8");
const governanceRecord = readFileSync("src/app/features/interdepartment-collaboration/components/governance/GovernanceRecordPanel.tsx", "utf8");
const legislativeSearch = readFileSync("src/app/features/role-legislative/components/SemanticSearch.tsx", "utf8");

describe("semantic teal primary actions", () => {
  it("uses product teal for proposal-import controls and the empty-state action", () => {
    expect(manualBuilder).toContain("bg-primary/10 text-primary");
    expect(manualBuilder).toContain("focus:border-ring");
    expect(manualBuilder).toContain("bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground");
    expect(manualBuilder).not.toContain("bg-indigo-600");
  });

  it("uses semantic teal for ordinary settings, task-board, and project-command actions", () => {
    expect(settingsProfile).toContain("bg-primary px-4 text-[12px] font-semibold text-primary-foreground");
    expect(taskHierarchy).toContain("bg-primary px-2 py-0.5 text-[10px] text-primary-foreground");
    expect(taskHierarchy).not.toContain("bg-blue-500 text-white px-2 py-0.5");
    expect(projectViewControls).toContain('background:var(--workspace-primary, var(--eflow-primary))');
  });

  it("uses teal for collaboration and legislative calls to action while retaining semantic blue elsewhere", () => {
    expect(governanceRecord).toContain("bg-primary px-3 py-2 text-[10px] text-primary-foreground");
    expect(governanceRecord).toContain("border-primary/25 bg-primary/5");
    expect(legislativeSearch).toContain("rounded-xl bg-primary px-5 py-3 text-[12px] font-semibold text-primary-foreground");
    expect(legislativeSearch).toContain("text-blue-600");
  });
});
