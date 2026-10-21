// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ProjectLifecycleLabel, ProjectScheduleLabel } from "../../src/app/features/projects/presentation/projectPresentation";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";

const workspaceCss = readFileSync("src/app/features/projects/components/projectsVibe.css", "utf8");
const projectsWorkspace = readFileSync("src/app/features/projects/components/ProjectsWorkspace.tsx", "utf8");
const governanceTab = readFileSync("src/app/features/projects/components/project-command/ProjectGovernanceTab.tsx", "utf8");
const projectViewTabBar = readFileSync("src/app/features/projects/components/project-command/ProjectViewTabBar.tsx", "utf8");
const projectViewMenus = readFileSync("src/app/features/projects/components/project-command/ProjectViewMenus.tsx", "utf8");

describe("Phase 03 project presentation", () => {
  it("communicates lifecycle and schedule independently with accessible text", () => {
    render(<EflowVibeThemeProvider preference="light"><ProjectLifecycleLabel status="active" /><ProjectScheduleLabel health="overdue" /></EflowVibeThemeProvider>);
    expect(screen.getByLabelText("Project lifecycle: Active")).toBeTruthy();
    expect(screen.getByLabelText("Project schedule: Overdue")).toBeTruthy();
  });

  it("does not communicate an unscheduled project by color alone", () => {
    render(<EflowVibeThemeProvider preference="light"><ProjectScheduleLabel health="on_track" empty /></EflowVibeThemeProvider>);
    expect(screen.getByLabelText("Project schedule: no scheduled work")).toBeTruthy();
  });

  it("keeps the project context rail and view actions separate while the canvas scrolls", () => {
    expect(projectsWorkspace).not.toContain("ProjectContextSidebar");
    expect(workspaceCss).toContain(".eflow-workspace-tabs__scroller");
    expect(workspaceCss).toMatch(/\.eflow-figma-board\s*\{\s*width:\s*100%;/);
    expect(workspaceCss).toContain("overflow-x: auto;");
    expect(projectViewMenus).toContain('aria-haspopup="menu"');
    expect(projectViewTabBar).toContain("Fixed action lane");
  });

  it('uses the common project index and persistent actions in standalone mode',()=>{
    expect(projectsWorkspace).toContain('<ProjectIndex');expect(projectsWorkspace).toContain('<ProjectWorkspaceActions');expect(projectsWorkspace).not.toContain('navigationHost');
  });

  it("uses the workspace view bar as the single governance navigation level", () => {
    expect(governanceTab).toContain("Governance workspace");
    expect(governanceTab).not.toContain("setSubView");
  });
});
