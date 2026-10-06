import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import ts from "typescript";

const root = process.cwd();
const output = "docs/product-refinement/phase17-registry";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const normalize = (value) => value.replaceAll("\\", "/");
const files = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(target)
      : [normalize(path.relative(root, target))];
  });
const semantic =
  /^(create|update|delete|remove|save|submit|assign|unassign|approve|reject|accept|revoke|archive|restore|upload|resend|invite|commit|transition|mark|complete|activate|cancel|record|link|resolve|propose|publish|withdraw|review|start|signOut|signIn|resetPassword|changePassword|setRolePermission|setUserOverride|setTask|setSubtask|setProject|setMember|setGovernance|setBudget|addDoc|setDoc|updateDoc|deleteDoc|writeBatch|on[A-Z]|mutate|execute)/;
const direct = new Set([
  "insert",
  "update",
  "upsert",
  "delete",
  "upload",
  "remove",
  "rpc",
  "setItem",
  "removeItem",
  "clear",
  "signInWithPassword",
  "signOut",
  "updateUser",
  "resetPasswordForEmail",
]);
const wrappers = new Set(["run", "act", "performAction", "operation"]);
function handlerOf(node, source) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent))
      return parent.name?.getText(source) || "anonymous";
    if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
      const owner = parent.parent;
      if (
        ts.isVariableDeclaration(owner) ||
        ts.isPropertyAssignment(owner) ||
        ts.isJsxAttribute(owner)
      )
        return owner.name.getText(source);
      if (ts.isJsxExpression(owner) && ts.isJsxAttribute(owner.parent))
        return owner.parent.name.getText(source);
    }
  }
  return "module";
}
function scan(file, text) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = new Map();
  for (const node of source.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !node.importClause ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const specifier = node.moduleSpecifier.text;
    const bindings = node.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const imported of bindings.elements)
        imports.set(imported.name.text, {
          specifier,
          exported: imported.propertyName?.text || imported.name.text,
        });
  }
  const ordinals = new Map(),
    rows = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression,
        call = expression.getText(source);
      const name = ts.isIdentifier(expression)
        ? expression.text
        : ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : "";
      const post =
        name === "fetch" &&
        node.arguments.some((argument) =>
          /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i.test(
            argument.getText(source),
          ),
        );
      if (
        semantic.test(name) ||
        direct.has(name) ||
        wrappers.has(name) ||
        post
      ) {
        const handler = handlerOf(node, source),
          rpc =
            name === "rpc" &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
              ? node.arguments[0].text
              : undefined;
        const signature = `${file}|${handler}|${call}|${rpc || ""}`;
        const ordinal = (ordinals.get(signature) || 0) + 1;
        ordinals.set(signature, ordinal);
        const imported = imports.get(name);
        rows.push({
          id: `A17-${hash(`${signature}|${ordinal}`).slice(0, 16)}`,
          file,
          line:
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1,
          handler,
          call,
          rpc,
          ordinal,
          imported,
          trigger: /onKey/.test(handler)
            ? "keyboard"
            : /onBlur/.test(handler)
              ? "blur autosave"
              : /onClick|onSubmit|onConfirm|onSave/.test(handler)
                ? "UI action"
                : file.includes("/hooks/")
                  ? "hook/caller"
                  : "service/helper/caller",
          candidate: rpc
            ? "RPC: read/write requires semantic review"
            : direct.has(name)
              ? "direct persistence or adapter"
              : wrappers.has(name)
                ? "operation wrapper"
                : "semantic caller",
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return rows;
}
function resolveModule(file, specifier) {
  if (!specifier?.startsWith(".")) return null;
  const base = normalize(path.join(path.dirname(file), specifier));
  return (
    [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ].find(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    ) || null
  );
}
function resolveExport(file, exported, seen = new Set()) {
  if (!file || seen.has(`${file}:${exported}`)) return file;
  seen.add(`${file}:${exported}`);
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const node of source.statements) {
    if (
      !ts.isExportDeclaration(node) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const target = resolveModule(file, node.moduleSpecifier.text);
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      const entry = node.exportClause.elements.find(
        (item) => item.name.text === exported,
      );
      if (entry)
        return resolveExport(
          target,
          entry.propertyName?.text || entry.name.text,
          seen,
        );
    } else if (target) {
      const text = fs.readFileSync(target, "utf8");
      if (new RegExp(`\\b${exported}\\b`).test(text))
        return resolveExport(target, exported, seen);
    }
  }
  return file;
}
function sqlDefinitions() {
  const definitions = new Map();
  for (const file of files("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const text = fs.readFileSync(file, "utf8");
    const pattern = /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(/gi;
    for (const match of text.matchAll(pattern)) {
      const start = match.index,
        end = text.indexOf("$$;", start);
      if (end < 0) continue;
      const body = text.slice(start, end + 3);
      definitions.set(match[1].split(".").at(-1), {
        file,
        line: text.slice(0, start).split("\n").length,
        sourceHash: hash(body),
        guardExpressions: [
          ...body.matchAll(
            /(?:if|elsif)\s+([^;]+?)\s+then\s+(?:raise exception|return)/gi,
          ),
        ]
          .slice(0, 12)
          .map((match) => match[1].replace(/\s+/g, " ").trim()),
        audit: /insert\s+into\s+(?:public\.)?audit_events/i.test(body)
          ? "SQL body inserts audit_events in the RPC transaction; effective deployment and later triggers still require verification."
          : /insert\s+into\s+(?:public\.)?budget_ledger_entries/i.test(body)
            ? "SQL body inserts budget_ledger_entries; an audit_events guarantee is not established by this evidence."
            : "Not verified: no audit_events or budget ledger insert in this function body; triggers and delegated calls require review.",
      });
    }
  }
  return definitions;
}
function family(file) {
  return (
    file.match(/src\/app\/features\/([^/]+)/)?.[1] ||
    (file.startsWith("server/") ? "gateway" : "shared-legacy")
  );
}
const testsFor = (owner) =>
  ({
    tasks: [
      "tests/unit/taskTeamEditorDialog.test.tsx",
      "tests/unit/taskTeamService.test.ts",
      "tests/unit/taskEditorSave.test.tsx",
      "tests/e2e/phase17-safety.spec.ts",
    ],
    projects: ["tests/unit/projectLifecycle.test.tsx"],
    "project-table": ["tests/unit/projectSubitems.test.tsx"],
    invitations: ["tests/unit/phase14InvitationManagement.test.tsx"],
    budget: [
      "tests/unit/accountingSettlementAuthority.test.tsx",
      "tests/unit/cashReleaseOverride.test.tsx",
      "tests/unit/phase17FinancialCancellation.test.tsx",
    ],
    "interdepartment-collaboration": [
      "tests/unit/defenseRevisionInteractions.test.tsx",
      "tests/unit/phase17StaffingSafety.test.tsx",
      "tests/unit/phase17GovernanceSafety.test.tsx",
    ],
    "shared-legacy": ["tests/unit/phase17Safety.test.tsx"],
    administration: ["tests/unit/adminAccountProtection.test.ts"],
    "project-offices": ["tests/unit/projectOfficeAuthority.test.ts"],
    "professional-profile": ["tests/e2e/phase15-ai-governance.spec.ts"],
  })[owner] || [];

if (process.argv.includes("--self-test")) {
  const sample = "export function saveRecord() { service.update({}); }";
  assert.equal(
    scan("src/sample.ts", sample)[0].id,
    scan("src/sample.ts", `\n\n${sample}`)[0].id,
  );
  assert.notEqual(
    scan(
      "src/sample.ts",
      `${sample}\nfunction next() { service.update({}); }`,
    )[0].id,
    scan(
      "src/sample.ts",
      `${sample}\nfunction next() { service.update({}); }`,
    )[1].id,
  );
  assert.equal(
    scan("src/sample.tsx", "<button onClick={() => removeRecord()}/>")[0]
      .trigger,
    "UI action",
  );
  assert.equal(
    scan("src/sample.tsx", "<input onBlur={() => updateRecord()}/>")[0].trigger,
    "blur autosave",
  );
  assert.equal(
    scan("src/sample.ts", 'supabase.rpc("readiness");')[0].rpc,
    "readiness",
  );
  assert.equal(scan("src/sample.ts", "supabase.rpc();")[0].rpc, undefined);
  console.log("Registry scanner: 6 regression assertions passed.");
  process.exit(0);
}

const sourceFiles = files("src")
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .sort();
const sql = sqlDefinitions();
const candidates = sourceFiles.flatMap((file) =>
  scan(file, fs.readFileSync(file, "utf8")),
);
// Python is indexed as a bounded call-site inventory, not claimed as an AST/authority proof.
const gatewayFiles = files("server")
  .filter((file) => file.endsWith(".py") && !file.includes("/tests/"))
  .sort();
for (const file of gatewayFiles) {
  const text = fs.readFileSync(file, "utf8");
  let handler = "module";
  const ordinals = new Map();
  text.split("\n").forEach((line, index) => {
    const definition = line.match(/^\s*(?:async\s+)?def\s+(\w+)\(/);
    if (definition) handler = definition[1];
    for (const match of line.matchAll(
      /\b((?:[\w.]+\.)?(?:insert|update|upsert|delete|rpc|create_user|update_user_by_id|delete_user|invite_user_by_email))\s*\(/g,
    )) {
      const signature = `${file}|${handler}|${match[1]}`,
        ordinal = (ordinals.get(signature) || 0) + 1;
      ordinals.set(signature, ordinal);
      candidates.push({
        id: `A17-${hash(`${signature}|${ordinal}`).slice(0, 16)}`,
        file,
        line: index + 1,
        handler,
        call: match[1],
        ordinal,
        trigger: "gateway caller",
        candidate: "Python textual candidate: semantic review required",
      });
    }
  });
}
const reviewPath = `${output}/reviews.json`;
const existingReviews = fs.existsSync(reviewPath)
  ? JSON.parse(fs.readFileSync(reviewPath, "utf8"))
  : {};
const update = process.argv.includes("--update");
const missing = candidates.filter((row) => !existingReviews[row.id]);
if (missing.length && !update)
  throw new Error(
    `${missing.length} unreviewed callers. Explicitly triage with npm run safety:update and review the generated gates; no silent certification.`,
  );
const reviews = Object.fromEntries(
  candidates.map((row) => [
    row.id,
    {
      disposition:
        existingReviews[row.id]?.disposition || "blocked-release-claim",
      gate: existingReviews[row.id]?.gate || `S17-${family(row.file)}`,
      reason:
        "Effective authority, audit and recovery not verified; see the owned gate.",
    },
  ]),
);
const contract = {
  entryAndActor:
    "Existing navigation/role/Office/task context retained. Exact effective role/capability is gated per caller.",
  capability:
    "Not verified. Inspect source, resolved service and effective server policies before a new authority claim.",
  blockers:
    "Not verified beyond linked SQL guard expressions. Dependencies must remain server checked.",
  undo: "Not verified; no new Undo or automatic destructive retry.",
  dirtyFields:
    "Inspect the feature baseline/useExplicitDraft. Candidate-specific evidence remains gated.",
  pending:
    "Converted callers use synchronous pending refs. Existing caller protections require review.",
  success:
    "Converted callers keep known receipts before refresh. Completion guarantees vary by service.",
  retry:
    "Converted unknown writes are held in the mounted context. Read the current record independently before retrying. This is not persisted idempotency.",
  audit:
    "Not verified. RPCs, triggers, gateway and client writers have different guarantees.",
  tests:
    "Listed files are regression references, not proof of coverage of this exact caller.",
  rolloutRollbackOwner:
    "The named feature maintainers. Roll back UI conversion independently and preserve server protections.",
};
const entries = candidates.map((row) => {
  const owner = family(row.file),
    service = row.imported
      ? resolveExport(
          resolveModule(row.file, row.imported.specifier),
          row.imported.exported,
        )
      : null;
  const evidence = row.rpc ? sql.get(row.rpc) : undefined;
  const severe =
    /delete|revoke|settle|release|posting|publish|completeProposal|closeout|archiveProposal|override/i.test(
      row.call + (row.rpc || ""),
    );
  const local =
    /(?:localStorage|sessionStorage)\.(?:setItem|removeItem|clear)$/.test(
      row.call,
    );
  return {
    ...row,
    feature: owner,
    serviceSource: service,
    sourceHash: hash(fs.readFileSync(row.file, "utf8")),
    safetyContract: "candidate-v1",
    serverEvidence: evidence || null,
    risk: local ? 1 : severe ? 3 : 2,
    riskEvidence: "Contextual triage estimate, not certification.",
    testReferences: testsFor(owner).filter((file) => fs.existsSync(file)),
    ...reviews[row.id],
  };
});
const counts = Object.entries(
  entries.reduce((result, row) => {
    const key = row.feature;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {}),
).sort(([a], [b]) => a.localeCompare(b));
const registry =
  JSON.stringify(
    {
      version: 1,
      scanner:
        "TypeScript AST + bounded Python candidate scan. Includes wrappers, reads, draft helpers and local preferences; semantic candidates are not equated with writes.",
      baseInventory:
        "docs/product-refinement/audit/inventory/mutations.json (frozen Phase 8A)",
      contracts: { "candidate-v1": contract },
      sourceManifest: Object.fromEntries(
        [
          ...sourceFiles,
          ...gatewayFiles,
          "scripts/phase17-safety-registry.mjs",
          ...new Set([...sql.values()].map((item) => item.file)),
        ].map((file) => [file, hash(fs.readFileSync(file, "utf8"))]),
      ),
      entries,
    },
    null,
    2,
  ) + "\n";
const coverage = `# Phase 17 mutation coverage\n\nGenerated by \`npm run safety:update\`; checked by \`npm run safety:check\`.\n\n${entries.length} concrete call-site candidates, ${entries.filter((row) => row.disposition === "blocked-release-claim").length} tracked release-claim gates. Candidate count includes local drafts, preferences, read RPCs and wrappers. It is not a count of destructive actions. No effective deployment or complete audit guarantee is certified by this registry.\n\n| Feature / gate owner | Candidates |\n| --- | ---: |\n${counts.map(([owner, count]) => `| ${owner} / S17-${owner} | ${count} |`).join("\n")}\n\nEach entry resolves its safety fields through the versioned candidate-v1 contract plus its own source/SQL evidence and owned disposition. Each has a stable ID, handler/trigger, source fingerprint, import/public-barrel service link, risk triage, actor/capability gate, available SQL guard/audit evidence, confirmation/blockers/Undo/dirty/pending/result/retry fields, tests and rollback owner. See [gates](../phase17-gates.md). The latest migration body is source evidence only; transitive SQL calls, triggers, overwritten overloads and live deployment remain verification gates. Python indexing is conservative textual navigation. Dynamic dispatch and uncommon verbs remain a completeness gate.\n`;
if (update) {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(reviewPath, JSON.stringify(reviews, null, 2) + "\n");
  fs.writeFileSync(`${output}/mutations.json`, registry);
  fs.writeFileSync(`${output}/coverage.md`, coverage);
} else {
  assert.equal(
    fs.readFileSync(`${output}/mutations.json`, "utf8"),
    registry,
    "Registry source/evidence changed; regenerate and review the diff.",
  );
  assert.equal(
    fs.readFileSync(`${output}/coverage.md`, "utf8"),
    coverage,
    "Coverage checklist is stale.",
  );
  assert(
    entries.every(
      (row) =>
        (row.disposition === "blocked-release-claim" &&
          row.gate &&
          row.reason) ||
        (row.disposition === "verified" &&
          row.testReferences.length &&
          row.serverEvidence),
    ),
    "Every entry must be verified with evidence or have an explicit owned gate.",
  );
}
console.log(
  `${update ? "Updated" : "Checked"} Phase 17 registry: ${entries.length} candidates, ${missing.length} newly triaged, ${counts.length} owned gate groups.`,
);
