// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ProjectLifecycleLabel, ProjectScheduleLabel } from "../../src/app/features/projects/presentation/projectPresentation";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";

const workspaceCss = readFileSync("src/app/features/projects/components/projectsVibe.css", "utf8");
const projectContextSidebar = readFileSync("src/app/features/projects/components/ProjectContextSidebar.tsx", "utf8");
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
    expect(workspaceCss).toMatch(/\.eflow-project-context\s*\{\s*position:\s*sticky;/);
    expect(workspaceCss).toContain(".eflow-workspace-tabs__scroller");
    expect(workspaceCss).toMatch(/\.eflow-figma-board\s*\{\s*width:\s*100%;/);
    expect(workspaceCss).toContain("overflow-x: auto;");
    expect(projectViewMenus).toContain('aria-haspopup="menu"');
    expect(projectViewTabBar).toContain("Fixed action lane");
  });

  it("uses the Vibe work icon as the neutral project mark until project logos exist", () => {
    expect(projectContextSidebar).toContain('import { Add, Archive, Check, Delete, MoreActions, Work } from "@vibe/icons";');
    expect(projectContextSidebar).toContain('<Work size={16} />');
    expect(projectContextSidebar).not.toContain("project.title?.slice(0, 1)");
    expect(workspaceCss).toContain(".eflow-project-context__project--active .eflow-project-context__project-mark");
    expect(workspaceCss).not.toContain(".eflow-project-context__project-mark--1");
  });

  it("uses the workspace view bar as the single governance navigation level", () => {
    expect(governanceTab).toContain("Governance workspace");
    expect(governanceTab).not.toContain("setSubView");
  });
});
