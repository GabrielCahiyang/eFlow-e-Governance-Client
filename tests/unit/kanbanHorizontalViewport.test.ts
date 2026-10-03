// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoardView } from "../../src/app/features/tasks/components/board/KanbanBoardView";

afterEach(cleanup);

describe("Kanban horizontal viewport", () => {
  it("pans the full status canvas by dragging empty board space", () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number }) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: TestPointerEvent });
    render(createElement(KanbanBoardView, { tasks: [], employees: [], role: "head" }));
    const viewport = screen.getByLabelText("Kanban status board");
    Object.defineProperty(viewport, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(viewport, "releasePointerCapture", { value: vi.fn() });
    viewport.scrollLeft = 300;

    fireEvent.pointerDown(viewport, { button: 0, pointerId: 7, clientX: 500 });
    fireEvent.pointerMove(viewport, { pointerId: 7, clientX: 320 });
    fireEvent.pointerUp(viewport, { pointerId: 7, clientX: 320 });

    expect(viewport.scrollLeft).toBe(480);
  });

  it("provides explicit left and right viewing controls", () => {
    render(createElement(KanbanBoardView, { tasks: [], employees: [], role: "head" }));
    expect(screen.getByRole("button", { name: "Scroll Kanban board left" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scroll Kanban board right" })).toBeTruthy();
  });
});
