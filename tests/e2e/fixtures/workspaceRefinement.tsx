// Test-only composition of production layout and controls, with synthetic data.
import "@vibe/core/tokens";
import "@fontsource-variable/figtree/wght.css";
import "../../../src/styles/index.css";
import "../../../src/app/features/app-shell/eflowAppShell.css";
import "../../../src/app/features/app-shell/navigationV2.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { EflowVibeThemeProvider } from "../../../src/app/shared/vibe";
import { PeopleAvatarStack, WorkspacePopover, WorkspaceShell } from "../../../src/app/components/ui/workspace";
import { ProjectLifecycleLabel, ProjectScheduleLabel } from "../../../src/app/features/projects/presentation/projectPresentation";
import { DataTable } from "../../../src/app/components/ui/DataTable";
import { Button } from "../../../src/app/components/ui/button";
import type { ThemePreference } from "../../../src/app/types";

function Proof() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [theme]);
  const people = ["Alex Rivera", "Maria Santos with a long participant name", "Jordan Diaz", "Sam Lee", "Pat Cruz"];
  const rows = Array.from({ length: 40 }, (_, index) => ({ id: index, name: `Work item ${index + 1}` }));
  return <EflowVibeThemeProvider preference={theme}><div className="eflow-app-shell">
    <header className="eflow-topbar" style={{ flexWrap: "wrap", paddingBlock: 8 }}><strong>eFlow</strong><div className="eflow-workspace-actions">{(["light", "dark", "system"] as const).map(value => <Button key={value} size="sm" variant="secondary" onClick={() => setTheme(value)}>{value} theme</Button>)}</div></header>
    <div className="eflow-app-shell__body">
      <section className="eflow-workspace-navigation eflow-scroll-region" aria-label="Sidebar" style={{ flex: "0 0 25%", maxWidth: 220 }}><nav>{rows.map(row => <button key={row.id} className="eflow-workspace-navigation__destination">Project {row.id + 1}</button>)}</nav></section>
      <main className="eflow-app-shell__workspace eflow-scroll-region" aria-label="Active workspace" tabIndex={-1}>
        <div className="eflow-role-content"><WorkspaceShell className="eflow-role-content__surface eflow-role-content__surface--padded">
          <h1>A long workspace title that wraps without pushing the page beyond its viewport</h1>
          <div className="eflow-workspace-actions"><ProjectLifecycleLabel status="planning" /><ProjectScheduleLabel health="on_track" /></div>
          <PeopleAvatarStack limit={2} people={people.map((name, id) => ({ id: String(id), name }))} />
          <WorkspacePopover tooltip="Show or hide supported columns" trigger={<Button variant="outline">Columns</Button>}><p>Task names and actions stay visible.</p><button>Owner column</button></WorkspacePopover>
          <DataTable density="compact" data={rows} keyExtractor={row => String(row.id)} columns={[{key:"name", header:"Task", render:row => row.name},{key:"details",header:"Details", render:() => <span style={{whiteSpace:"nowrap"}}>Representative long table content with a local horizontal scroll lane</span>}]} />
          <p>Final workspace content</p>
        </WorkspaceShell></div>
      </main>
    </div>
  </div></EflowVibeThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<Proof />);
