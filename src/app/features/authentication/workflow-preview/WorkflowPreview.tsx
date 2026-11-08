import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Building2, GitBranch, Play } from "lucide-react";
import { lazyFeature } from "../../../shared/lazyFeature";
import { WORKFLOW_GUIDES } from "./workflowGuides";
import type { WorkflowKind } from "./types";
import styles from "./WorkflowPreview.module.scss";

const WorkflowPreviewPanel = lazyFeature(() =>
  import("./WorkflowPreviewPanel").then((module) => ({ default: module.WorkflowPreviewPanel })),
);

function FlowButton({ kind }: { kind: WorkflowKind }) {
  const [open, setOpen] = useState(false);
  const Icon = kind === "interdepartmental" ? GitBranch : Building2;
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" className={styles.flowEntry}>
      <span className={styles.entryIcon}><Icon size={20} aria-hidden="true" /></span><span><strong>{WORKFLOW_GUIDES[kind].title}</strong><small>{kind === "interdepartmental" ? "Invite an outside office to a project" : "Run a funded project within one office"}</small></span><Play size={17} className={styles.entryArrow} aria-hidden="true" />
    </button></Dialog.Trigger>
    {open && <WorkflowPreviewPanel kind={kind} />}
  </Dialog.Root>;
}

export function WorkflowPreview() {
  return <section className={styles.guideEntry} aria-label="Explore eFlow workflows">
    <div className={styles.entryHeading}><h2>Watch eFlow in action</h2><p>Follow a sample project from setup to cash settlement and archive.</p></div>
    <div className={styles.entryButtons}><FlowButton kind="interdepartmental" /><FlowButton kind="department" /></div>
  </section>;
}
