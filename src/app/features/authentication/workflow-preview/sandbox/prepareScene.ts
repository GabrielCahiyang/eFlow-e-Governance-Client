import { ids } from "./sampleRecords";

function visible(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.getClientRects().length > 0;
}
async function waitFor<T>(read: () => T | undefined | null | false): Promise<T> {
  const initial = read();
  if (initial) return initial;
  return new Promise((resolve, reject) => {
    const finish = (value: T) => { observer.disconnect(); clearTimeout(timer); resolve(value); };
    const observer = new MutationObserver(() => { const result = read(); if (result) finish(result); });
    const timer = window.setTimeout(() => { observer.disconnect(); reject(new Error("The walkthrough screen did not finish loading.")); }, 25_000);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}
async function button(name: string, enabled = false) {
  return waitFor(() => [...document.querySelectorAll("button,[role=tab],[role=menuitem]")]
    .find(el => visible(el) && (!enabled || !el.matches(":disabled")) && (el.getAttribute("aria-label") === name || el.textContent?.replace(/\s+/g, " ").trim() === name || /^0[1-5] /.test(name) && el.textContent?.replace(/\s+/g, "").trim() === name.replace(/\s+/g, ""))) as HTMLElement | undefined);
}
async function click(name: string) { (await button(name, true)).click(); }
async function field(name: string) {
  return waitFor(() => {
    const byAria = [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")]
      .find(el => visible(el) && el.getAttribute("aria-label") === name);
    if (byAria) return byAria;
    const label = [...document.querySelectorAll("label")].find(el => visible(el) && el.textContent?.replace(/\s+/g, " ").trim().startsWith(name));
    return label?.control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
  });
}
async function fill(name: string, value: string) {
  const input = await field(name);
  const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function reveal(element: HTMLElement) {
  element.scrollIntoView({ block: "center", inline: "nearest" });
  element.setAttribute("data-walkthrough-focus", "");
}
export function sceneRoute(scene: string) {
  const project = `/projects?page=Projects&workspace=${ids.office}&project=${ids.project}&view=`;
  if (scene === "office-budget") return `/office-budget?page=Office%20Budget&view=annual&fy=2026&workspace=${ids.office}`;
  if (scene === "accept-invite") return "/accept-project-invite?token=" + "a".repeat(43);
  if (["subtasks", "request-cash", "receipts"].includes(scene)) return "/my-work?page=Leading";
  if (scene === "authorize") return "/reviews?view=budget";
  if (scene === "task-review") return "/reviews?view=tasks";
  if (scene === "release") return "/voucher-cash-releases?page=Voucher%20%26%20Cash%20Releases&fy=2026";
  if (scene === "settlement") return "/voucher-cash-releases?page=Settlements&fy=2026";
  if (["project-funding", "save-project", "return-funding"].includes(scene)) return project + "settings";
  if (["add-office", "invite-person"].includes(scene)) return project + "offices";
  if (scene === "create-project") return `/projects?page=Projects&workspace=${ids.office}`;
  return project + "tasks";
}
async function openTask() {
  const row = await waitFor(() => document.querySelector<HTMLButtonElement>(`[data-personal-task="${ids.task}"]`));
  row.click();
}
export async function prepareScene(scene: string) {
  if (scene === "accept-invite") { await fill("Full name", "Lia Santos"); return; }
  await waitFor(() => document.querySelector(".eflow-app-shell"));
  switch (scene) {
    case "office-budget":
      await waitFor(() => document.querySelector(".eflow-budget-workspace"));
      return;
    case "create-project":
      await click("Create project");
      await fill("Project title", "Community Services Seminar");
      await fill("Description", "Host a seminar for frontline staff.");
      return;
    case "add-task":
      await button("Open Prepare seminar materials");
      await click("New task");
      await fill("Task name", "Prepare seminar materials");
      return;
    case "project-funding":
    case "save-project":
    case "return-funding":
      await click(scene === "return-funding" ? "Manage project funding" : "Edit project details");
      if (scene === "save-project") { await click("05 Review"); return; }
      await click("04 Funding");
      if (scene === "return-funding") { reveal(await button("Return unused to project")); return; }
      await fill("Office Budget source", ids.source);
      await fill("Amount", "40000");
      await fill("Reason / approved authority reference", "Approved seminar work program");
      reveal(await button("Authorize project funding"));
      return;
    case "allocate-task":
      await click("Budget for Prepare seminar materials");
      await fill("Task budget account 1", ids.source);
      await fill("Task account 1 amount", "10000");
      await fill("Allocation reason", "Registration kits and printing");
      return;
    case "activate":
      await click("Setup & activation");
      reveal(await button("Activate project"));
      return;
    case "office-team":
      await click("+ Add people");
      reveal(await button("Save project team"));
      return;
    case "add-office":
      await click("Add named Office");
      await fill("Office name", "Community Training Center");
      return;
    case "invite-person":
      await click("Invite people");
      await fill("Email address", "lia@example.test");
      return;
    case "assign-guest":
      await click("Choose people");
      reveal(await button("Save changes"));
      return;
    case "subtasks":
      await openTask();
      await click("Work");
      return;
    case "request-cash":
    case "receipts":
      await openTask();
      await click("Overview");
      if (scene === "request-cash") {
        await click("Request cash");
        await fill("Amount", "4000");
        await fill("Needed by", "2026-11-15");
        await fill("Purpose", "Registration kits and printing");
        reveal(await field("Purpose"));
      } else {
        await click("Upload receipts");
        await fill("Vendor / payee", "Seminar Supplies");
        await fill("OR/AR number", "INV-12");
        await click("Add purchased item");
        await fill("Particulars", "Registration kits and printing");
        await fill("Actual cost", "3500");
        await fill("Official refund receipt number", "OR-RETURN-500");
        reveal(await field("Actual cost"));
      }
      return;
    case "release":
      await click("Mark released");
      await waitFor(() => [...document.querySelectorAll('[role=dialog]')].find(el => visible(el)));
      return;
    case "settlement": reveal(await button("Settle & post")); return;
    case "authorize": reveal(await button("Authorize")); return;
    case "task-review": reveal(await button("Request changes")); return;
    case "complete":
      await click("Completion requirements");
      await waitFor(() => [...document.querySelectorAll('[role=dialog]')].find(el => visible(el)));
      return;
    default: await waitFor(() => document.querySelector('[aria-label="Project main table"]'));
  }
}

