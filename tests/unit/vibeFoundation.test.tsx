// @vitest-environment jsdom

import "@fontsource-variable/figtree/wght.css";
import "@vibe/core/tokens";
import {
  Avatar,
  Button,
  Chips,
  Dialog,
  DialogContentContainer,
  EmptyState,
  IconButton,
  Label,
  Loader,
  Skeleton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TabsContext,
  TabList,
  TabPanel,
  TabPanels,
  TextField,
  Tooltip,
} from "@vibe/core";
import { Add, Info } from "@vibe/icons";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { TaskStatusLabel } from "../../src/app/features/tasks/presentation/TaskStatusLabel";
import { getTaskStatusPresentation } from "../../src/app/features/tasks/presentation/taskStatusPresentation";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";

afterEach(cleanup);

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function VibeProofFixture() {
  const [value, setValue] = useState("");
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <EflowVibeThemeProvider preference="light">
      <main>
        <Button onClick={() => undefined}>Create task</Button>
        <IconButton aria-label="Add task" icon={Add} />
        <TextField
          inputAriaLabel="Search tasks"
          value={value}
          onChange={setValue}
        />

        <TabsContext id="vibe-proof-tabs">
          <TabList id="vibe-proof-tab-list">
            <Tab id="vibe-proof-overview">Overview</Tab>
            <Tab id="vibe-proof-activity">Activity</Tab>
          </TabList>
          <TabPanels id="vibe-proof-tab-panels">
            <TabPanel id="vibe-proof-overview-panel">Overview content</TabPanel>
            <TabPanel id="vibe-proof-activity-panel">Activity content</TabPanel>
          </TabPanels>
        </TabsContext>

        <Table columns={[{ id: "task", title: "Task" }, { id: "status", title: "Status" }]}>
          <TableHeader>
            <TableHeaderCell title="Task" />
            <TableHeaderCell title="Status" />
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Publish quarterly report</TableCell>
              <TableCell><Label text="For review" color="working_orange" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Chips label="Evidence attached" />
        <Avatar aria-label="Jordan Diaz" text="JD" />
        <Tooltip content="Evidence guidance">
          <IconButton aria-label="Evidence guidance" icon={Info} />
        </Tooltip>

        <Dialog
          open={isDialogOpen}
          showTrigger={[]}
          hideTrigger={[]}
          content={<DialogContentContainer>Vibe dialog content</DialogContentContainer>}
        >
          <Button onClick={() => setDialogOpen(true)}>Open Vibe dialog</Button>
        </Dialog>

        <EmptyState title="No task updates" description="Updates will appear here when work changes." />
        <Loader size="small" />
        <Skeleton type="text" width={120} />
      </main>
    </EflowVibeThemeProvider>
  );
}

describe("Vibe foundation", () => {
  it("applies the eFlow Vibe theme and renders application children", () => {
    const { container, rerender } = render(
      <EflowVibeThemeProvider preference="dark">
        <div data-testid="vibe-child">eFlow child</div>
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByTestId("vibe-child").textContent).toBe("eFlow child");
    expect(container.querySelector("[class*='eflow-vibe']")).toBeTruthy();
    expect(document.body.className).toContain("dark-app-theme");
    expect(document.body.style.getPropertyValue("--primary-color")).toBe("var(--eflow-primary)");
    expect(document.head.textContent).toContain("--primary-color: var(--eflow-primary)");

    rerender(
      <EflowVibeThemeProvider preference="light">
        <div data-testid="vibe-child">eFlow child</div>
      </EflowVibeThemeProvider>,
    );
    expect(document.body.className).toContain("light-app-theme");
    expect(document.body.className).not.toContain("dark-app-theme");
    expect(document.body.style.getPropertyValue("--primary-color")).toBe("var(--eflow-primary)");
  });

  it("renders representative Vibe components with focus, table, and dialog behavior", async () => {
    render(<VibeProofFixture />);

    const createTask = screen.getByRole("button", { name: "Create task" });
    createTask.focus();
    expect(document.activeElement).toBe(createTask);

    fireEvent.change(screen.getByLabelText("Search tasks"), { target: { value: "quarterly" } });
    expect(screen.getByDisplayValue("quarterly")).toBeTruthy();
    expect(screen.getByText("Publish quarterly report")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open Vibe dialog" }));
    expect(await screen.findByText("Vibe dialog content")).toBeTruthy();
  });

  it("maps every known task status to visible and accessible text, not color alone", () => {
    const knownStatuses = [
      "pending_assignment",
      "todo",
      "in_progress",
      "for_review",
      "changes_requested",
      "rejected",
      "completed",
      "cancelled",
      "archived",
    ];

    knownStatuses.forEach((status) => {
      const presentation = getTaskStatusPresentation(status);
      expect(presentation.label).not.toBe("");
      expect(presentation.description).not.toBe("");
    });

    render(
      <EflowVibeThemeProvider preference="light">
        <TaskStatusLabel status="for_review" />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByLabelText(/For review\. This task is waiting for a reviewer decision\./)).toBeTruthy();
  });
});
