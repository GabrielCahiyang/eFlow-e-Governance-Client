// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoardView } from "../../src/app/features/tasks/components/board/KanbanBoardView";
import type { Task } from "../../src/app/services/taskService";

afterEach(cleanup);

describe("Kanban horizontal viewport", () => {
  it("opens a task from its card without offering status drag and drop", () => {
    const task={id:'task',title:'Prepare the agenda',status:'todo',assigneeId:'actor'} as Task;
    const open=vi.fn();
    const {container}=render(createElement(KanbanBoardView,{tasks:[task],employees:[],role:'head',currentUserId:'actor',onOpenTask:open}));
    expect(container.querySelector('[draggable="true"]')).toBeNull();
    expect(screen.queryByText('Drop here')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:task.title}));
    expect(open).toHaveBeenCalledWith(task);
  });
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
