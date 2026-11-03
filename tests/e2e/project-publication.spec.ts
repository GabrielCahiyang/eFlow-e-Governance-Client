import { test, expect } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
test("Head reviews an archived record; simulation is not a verified seal", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const records = await projectWorkspaceFixture(page, "head");
  records.projects[0].status = "archived";
  records.projects[0].archived_at = new Date().toISOString();
  let manifest = JSON.stringify({
    schema_version: 1,
    records: {
      project: { title: "Community outreach", scope: "QA publication review" },
      tasks: [{ title: "Prepare community assessment", status: "completed" }],
      cash_requests: [],
    },
    files: [
      {
        section: "task_files",
        record_id: "evidence",
        name: "Evidence.pdf",
        mime_type: "application/pdf",
        sha256: "b".repeat(64),
        size: 100,
        path: `files/${"b".repeat(64)}`,
      },
    ],
  });
  let state = "review_ready",
    approved = 0,
    manifestHash = "a".repeat(64);
  const seal = () => ({
    id: "50000000-0000-4000-8000-000000000001",
    project_id: records.project,
    version: 1,
    state,
    manifest,
    manifest_hash: manifestHash,
    error: null,
    approved_at: null,
  });
  await page.route("**/rest/v1/rpc/project_seal_status", (route) =>
    route.fulfill({ json: { project_id: records.project, snapshot: seal() } }),
  );
  await page.route("**/project-seals/configuration", (route) =>
    route.fulfill({
      json: {
        mode: "simulation",
        chain_id: 80002,
        configured: false,
        worker_enabled: true,
        message:
          "Simulation only. No public records or real blockchain certificate.",
      },
    }),
  );
  await page.route("**/rest/v1/rpc/approve_project_seal", async (route) => {
    expect(route.request().postDataJSON().p_manifest_hash).toBe("c".repeat(64));
    approved++;
    state = "simulation";
    await route.fulfill({ json: { id: seal().id, state } });
  });
  await page.route("**/storage/v1/object/project-seal-copies/**", (route) =>
    route.fulfill({ json: { Key: "publication-copy" } }),
  );
  await page.route("**/project-seals/snapshots/*/publication-copy", (route) => {
    const next = JSON.parse(manifest);
    next.files[0] = {
      ...next.files[0],
      name: "Public-evidence.pdf",
      sha256: "d".repeat(64),
      path: `files/${"d".repeat(64)}`,
      publication_copy_note: "Removed private contact details",
      publication_copy_of: "b".repeat(64),
    };
    manifest = JSON.stringify(next);
    manifestHash = "c".repeat(64);
    return route.fulfill({
      json: { id: seal().id, manifest_hash: manifestHash },
    });
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Seal on blockchain", exact: true })
    .click({ timeout: 60000 });
  const dialog = page.getByRole("dialog", {
    name: "Seal project on blockchain",
  });
  await expect(
    dialog.getByText("Ready for your review", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Run simulation" }),
  ).toBeDisabled();
  await dialog.locator("summary").filter({ hasText: "Project" }).click();
  await expect(
    dialog.getByText("QA publication review", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Use publication copy", exact: true })
    .click();
  const copy = page.getByRole("dialog", {
    name: "Use a publication copy",
    exact: true,
  });
  await copy
    .locator("input[type=file]")
    .setInputFiles({
      name: "Public-evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("QA public evidence copy"),
    });
  await copy.getByRole("textbox").fill("Removed private contact details");
  await copy
    .getByRole("button", { name: "Save publication copy", exact: true })
    .click();
  await expect(copy).toHaveCount(0);
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(
    dialog.getByText("Publication copy: Removed private contact details"),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("project-seal-review-desktop.png"),
    fullPage: true,
  });
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Run simulation" }).click();
  await expect(
    dialog.getByText("Simulation finished", { exact: true }),
  ).toBeVisible();
  expect(approved).toBe(1);
  await expect(
    dialog.getByRole("link", { name: "View public project record" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.screenshot({
    path: info.outputPath("project-seal-simulation-1100.png"),
    fullPage: true,
  });
});
test("Public archive works without sign-in or the AI host and rejects tampering", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const id = "50000000-0000-4000-8000-000000000001",
    project = "20000000-0000-4000-8000-000000000001";
  const text = JSON.stringify({
    schema_version: 1,
    snapshot_id: id,
    project_id: project,
    version: 1,
    records: {
      project: { title: "QA Public Project" },
      tasks: [{ title: "Delivery", status: "completed" }],
    },
    files: [],
  });
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(text).digest("hex");
  let tampered = false;
  await page.route("**/rest/v1/project_seal_certificates*", (route) =>
    route.fulfill({
      json: {
        id,
        project_id: project,
        version: 1,
        title: "QA Public Project",
        manifest_hash: hash,
        archive_uri: `https://ixnfphgjyelhckjwjkdv.supabase.co/storage/v1/object/public/project-seal-public/${hash}/manifest.json`,
        chain_id: 80002,
        tx_hash: "0x" + "a".repeat(64),
        sealed_at: "2026-11-03T00:00:00Z",
      },
    }),
  );
  await page.route(
    "**/storage/v1/object/public/project-seal-public/**",
    (route) =>
      route.fulfill({
        body: tampered ? "tampered" : text,
        contentType: "application/json",
      }),
  );
  await page.goto(`/project-record/${id}`);
  await expect(
    page.getByRole("heading", { name: "QA Public Project" }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByText("Archive fingerprint matches", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("public-record-desktop.png"),
    fullPage: true,
  });
  tampered = true;
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "does not match its published fingerprint",
  );
});
