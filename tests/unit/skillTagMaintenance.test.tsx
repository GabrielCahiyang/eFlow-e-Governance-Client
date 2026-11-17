// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillTagSelector } from "../../src/app/components/ui/SkillTagSelector";
import { activeSkillTagLabels, sortSkillTagDefinitions } from "../../src/app/shared/skillTags";

afterEach(cleanup);

describe("skill tag catalog & selector", () => {
  it("orders active skill tags and excludes hidden tags from new selections", () => {
    const ordered = sortSkillTagDefinitions([
      { id: "2", label: "Procurement", position: 30, retired: false },
      { id: "1", label: "Budgeting", position: 10, retired: false },
      { id: "3", label: "Legacy", position: 5, retired: true },
    ]);
    expect(ordered.map((x) => x.label)).toEqual(["Legacy", "Budgeting", "Procurement"]);
    expect(activeSkillTagLabels(ordered)).toEqual(["Budgeting", "Procurement"]);
  });

  it("lets invited users toggle maintained skill chips by pressing buttons without text input", () => {
    const handleChange = vi.fn();
    render(
      <SkillTagSelector
        availableTags={["Budgeting", "Procurement"]}
        selected={["Legacy custom"]}
        onChange={handleChange}
      />,
    );

    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Budgeting" }));
    expect(handleChange).toHaveBeenCalledWith(["Legacy custom", "Budgeting"]);

    fireEvent.click(screen.getByRole("button", { name: /Legacy custom/ }));
    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
