// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";
import { ProductivitySidebar, type ShellNavigationItem } from "../../src/app/features/app-shell/components/ProductivitySidebar";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
}

const navigationItems: ShellNavigationItem[] = [
  {
    id: "dashboard",
    icon: null,
    label: "Overview",
    group: "workspaces",
    pages: [{ label: "Dashboard" }],
  },
  {
    id: "budget",
    icon: null,
    label: "Office Budget",
    group: "workspaces",
    pages: [{ label: "Overview" }, { label: "Budget Board" }],
  },
];

afterEach(() => cleanup());

function SidebarFixture({ onPageSelect = vi.fn() }: { onPageSelect?: (section: string, page: string) => void }) {
  const [selection, setSelection] = useState({ section: "dashboard", page: "Dashboard" });

  return (
    <EflowVibeThemeProvider preference="light">
      <ProductivitySidebar
        activePage={selection.page}
        activeSection={selection.section}
        navigationItems={navigationItems}
        role="head"
        onPageSelect={(section, page) => {
          onPageSelect(section, page);
          setSelection({ section, page });
        }}
      />
    </EflowVibeThemeProvider>
  );
}

describe("Phase 02 productivity sidebar", () => {
  it("keeps the registered destination and page callback intact", () => {
    const onPageSelect = vi.fn();
    render(<SidebarFixture onPageSelect={onPageSelect} />);
    fireEvent.mouseEnter(screen.getByRole("complementary", { name: "Primary navigation" }));

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(onPageSelect).toHaveBeenCalledWith("dashboard", "Dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Budget Board" }));
    expect(onPageSelect).toHaveBeenLastCalledWith("budget", "Budget Board");
    expect(screen.getByRole("button", { name: "Budget Board" }).getAttribute("aria-current")).toBe("page");
  });

  it("keeps labelled global destinations available without hover", () => {
    render(<SidebarFixture />);

    const sidebar = screen.getByRole("complementary", { name: "Primary navigation" });
    expect(sidebar.getAttribute("data-navigation-density")).toBe("expanded");

    fireEvent.mouseEnter(sidebar);
    expect(sidebar.getAttribute("data-navigation-density")).toBe("expanded");
    expect(screen.getByRole("button", { name: "Workspace" })).toBeTruthy();

    fireEvent.mouseLeave(sidebar);
    expect(sidebar.getAttribute("data-navigation-density")).toBe("expanded");
  });

  it("opens all projects when clicking the Projects folder and toggles project list with its dropdown", () => {
    const onPageSelect = vi.fn();
    render(
      <EflowVibeThemeProvider preference="light">
        <ProductivitySidebar
          activePage="Dashboard"
          activeSection="dashboard"
          navigationItems={[
            ...navigationItems,
            { id: "projects", icon: null, label: "Projects", group: "workspaces", pages: [{ label: "Projects" }] },
          ]}
          role="head"
          projects={[{ id: "proj-1", title: "Community Outreach", status: "active" }]}
          onPageSelect={onPageSelect}
        />
      </EflowVibeThemeProvider>,
    );

    expect(screen.queryByRole("button", { name: "All projects" })).toBeNull();
    expect(screen.getByRole("button", { name: "Community Outreach" })).toBeTruthy();

    const sections = Array.from(document.querySelectorAll(".eflow-workspace-section")).map((node) =>
      node.getAttribute("aria-label"),
    );
    expect(sections).toEqual(["Office tools", "Projects", "Favorites", "Archived projects"]);
    expect(screen.getByRole("button", { name: "Archived projects" }).getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(onPageSelect).toHaveBeenLastCalledWith("projects", "Projects");

    fireEvent.click(screen.getByRole("button", { name: "Collapse Projects" }));
    expect(screen.getByRole("button", { name: "Expand Projects" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Community Outreach" })).toBeNull();
  });
});
