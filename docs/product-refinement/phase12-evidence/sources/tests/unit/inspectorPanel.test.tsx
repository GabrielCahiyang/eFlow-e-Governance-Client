// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotionConfig } from "motion/react";
import { EflowMotionProvider, InspectorPanel } from "../../src/app/shared/motion";
import { createPortal } from "react-dom";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.getElementById("root")?.remove();
});

function renderInspector(open: boolean, onClose = vi.fn()) {
  return render(
    <EflowMotionProvider>
      <InspectorPanel open={open} onClose={onClose} ariaLabel="Task inspector">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </InspectorPanel>
    </EflowMotionProvider>,
  );
}

describe("InspectorPanel", () => {
 it('restores focus through the origin resolver when a refreshed source node was removed',async()=>{
  const source=document.createElement('button');document.body.appendChild(source);source.focus();const fallback=vi.fn();
  const view=render(<EflowMotionProvider><InspectorPanel open onClose={()=>{}} returnFocus={source} onReturnFocus={fallback} ariaLabel="Refreshed task"><button>Task action</button></InspectorPanel></EflowMotionProvider>);
  source.remove();view.unmount();await waitFor(()=>expect(fallback).toHaveBeenCalledOnce());
 });

  it("leaves nested portal keys with their owner and releases locks on unmount", async () => {
    const root = document.createElement("div");root.id="root";document.body.appendChild(root);
    document.body.style.overflow="clip";root.setAttribute("aria-hidden","false");
    const close = vi.fn();
    const view=render(<EflowMotionProvider><InspectorPanel open onClose={close} ariaLabel="Portal owner"><button>Parent control</button>{createPortal(<button>Nested picker</button>,document.body)}</InspectorPanel></EflowMotionProvider>);
    fireEvent.keyDown(screen.getByRole("button",{name:"Nested picker"}),{key:"Escape"});expect(close).not.toHaveBeenCalled();
    view.unmount();expect(root.inert).toBe(false);expect(root.getAttribute("aria-hidden")).toBe("false");expect(document.body.style.overflow).toBe("clip");
  });
  it("keeps the application locked until the final inspector closes", async () => {
    const root=document.createElement("div");root.id="root";document.body.appendChild(root);
    const close=vi.fn(),nestedClose=vi.fn();
    const first=renderInspector(true,close);
    const second=render(<EflowMotionProvider><InspectorPanel open layer={60} onClose={nestedClose} ariaLabel="Nested inspector"><button>Child control</button></InspectorPanel></EflowMotionProvider>);
    fireEvent.keyDown(screen.getByRole("dialog",{name:"Task inspector"}),{key:"Escape"});expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog",{name:"Nested inspector"}),{key:"Escape"});expect(nestedClose).toHaveBeenCalledOnce();
    second.unmount();expect(root.inert).toBe(true);expect(document.body.style.overflow).toBe("hidden");
    first.unmount();expect(root.inert).toBe(false);expect(document.body.style.overflow).toBe("");
  });
  it("locks the application and closes from Escape", async () => {
    const appRoot = document.createElement("div");
    appRoot.id = "root";
    document.body.appendChild(appRoot);
    const onClose = vi.fn();

    renderInspector(true, onClose);

    const dialog = await screen.findByRole("dialog", { name: "Task inspector" });
    expect(document.body.style.overflow).toBe("hidden");
    expect(appRoot.inert).toBe(true);
    expect(appRoot.getAttribute("aria-hidden")).toBe("true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("inspector-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("traps focus and restores it when closed", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open inspector";
    document.body.appendChild(trigger);
    trigger.focus();

    const view = renderInspector(true);
    const first = await screen.findByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    await waitFor(() => expect(document.activeElement).toBe(first));

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    view.rerender(
      <EflowMotionProvider>
        <InspectorPanel open={false} onClose={vi.fn()} ariaLabel="Task inspector">
          <button type="button">First action</button>
        </InspectorPanel>
      </EflowMotionProvider>,
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });

  it("inherits the application reduced-motion policy", () => {
    function ReducedMotionProbe() {
      return <output>{String(useReducedMotionConfig())}</output>;
    }

    render(
      <EflowMotionProvider reducedMotion="always">
        <ReducedMotionProbe />
      </EflowMotionProvider>,
    );
    expect(screen.getByText("true", { selector: "output" })).toBeTruthy();
  });
});
