import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Building2, GitBranch } from "lucide-react";
import { WorkflowPreviewPanel } from "./WorkflowPreviewPanel";
import { WORKFLOW_GUIDES } from "./workflowGuides";
import type { WorkflowKind } from "./types";
import styles from "./WorkflowPreview.module.scss";

function FlowButton({ kind }: { kind: WorkflowKind }) {
  const [open, setOpen] = useState(false);
  const Icon = kind === "interdepartmental" ? GitBranch : Building2;
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" className={styles.flowEntry}>
      <span className={styles.entryIcon}><Icon size={20} aria-hidden="true" /></span><span><strong>{WORKFLOW_GUIDES[kind].title}</strong><small>{kind === "interdepartmental" ? "Several offices working together" : "Work within one office"}</small></span><ArrowUpRight size={17} className={styles.entryArrow} aria-hidden="true" />
    </button></Dialog.Trigger>
    {open && <WorkflowPreviewPanel kind={kind} />}
  </Dialog.Root>;
}

export function WorkflowPreview() {
  return <section className={styles.guideEntry} aria-label="Explore eFlow workflows">
    <div className={styles.entryHeading}><h2>See how work flows.</h2><p>Follow a proposal from its first draft to its archived record.</p></div>
    <div className={styles.entryButtons}><FlowButton kind="interdepartmental" /><FlowButton kind="department" /></div>
  </section>;
}
