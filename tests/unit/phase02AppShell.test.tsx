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
    group: "Office",
    pages: [{ label: "Dashboard" }],
  },
  {
    id: "tasks",
    icon: null,
    label: "Tasks",
    group: "Office",
    pages: [{ label: "My Tasks" }, { label: "Task Board" }],
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

    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(onPageSelect).toHaveBeenCalledWith("tasks", "My Tasks");

    fireEvent.click(screen.getByRole("button", { name: "Task Board" }));
    expect(onPageSelect).toHaveBeenLastCalledWith("tasks", "Task Board");
    expect(screen.getByRole("button", { name: "Tasks" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("reveals the labelled navigation on hover without manual toggle buttons", () => {
    render(<SidebarFixture />);

    const sidebar = screen.getByRole("complementary", { name: "Primary navigation" });
    expect(sidebar.getAttribute("data-navigation-density")).toBe("compact");

    fireEvent.mouseEnter(sidebar);
    expect(sidebar.getAttribute("data-navigation-density")).toBe("expanded");
    expect(screen.getByRole("button", { name: "Tasks" })).toBeTruthy();

    fireEvent.mouseLeave(sidebar);
    expect(sidebar.getAttribute("data-navigation-density")).toBe("compact");
  });
});
