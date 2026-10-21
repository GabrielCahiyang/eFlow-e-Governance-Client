// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InlineEditableText } from "../../src/app/components/ui/workspace/InlineEditableText";
afterEach(cleanup);
describe("inline project title freshness", () => {
  it("retains a stale title draft and rejects saving against a newer version", () => {
    const save = vi.fn();
    const view = render(
      <InlineEditableText
        label="project name"
        value="Original"
        revision="exact-v1"
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit project name" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Unsaved title" },
    });
    view.rerender(
      <InlineEditableText
        label="project name"
        value="Other tab title"
        revision="exact-v2"
        onSave={save}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(screen.getByDisplayValue("Unsaved title")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "updated elsewhere",
    );
    expect(save).not.toHaveBeenCalled();
  });
  it("prevents a previously opened title editor from saving after authority is removed", () => {
    const save = vi.fn();
    const view = render(
      <InlineEditableText
        label="project name"
        value="Original"
        revision="v1"
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit project name" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Draft" },
    });
    view.rerender(
      <InlineEditableText
        label="project name"
        value="Original"
        revision="v1"
        onSave={save}
        disabled
      />,
    );
    fireEvent.blur(screen.getByRole("textbox"));
    expect(save).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
