import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

// Follow emitted, static imports so a new barrel re-export cannot silently
// pull the authenticated workspace back into the signed-out entry point.
function startupModules(entry: string) {
  const visited = new Set<string>();
  const pending = [path.resolve(entry)];
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    });
    const source = ts.createSourceFile(file, outputText, ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      const name = specifier.text;
      if (!name.startsWith(".") && !name.startsWith("@/")) continue;
      const base = name.startsWith("@/")
        ? path.resolve("src", name.slice(2))
        : path.resolve(path.dirname(file), name);
      const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]
        .find(candidate => /\.[jt]sx?$/.test(candidate) && existsSync(candidate));
      if (target) pending.push(target);
    }
  }
  return visited;
}

it("renders login without importing authenticated workspaces or closed workflow guides", () => {
  const modules = startupModules("src/main.tsx");
  expect(modules.has(path.resolve("src/pages/Login/Login.tsx"))).toBe(true);
  for (const file of [
    "src/app/features/app-shell/EflowAppShell.tsx",
    "src/app/features/app-shell/SignedInApp.tsx",
    "src/app/features/authentication/workflow-preview/WorkflowPreviewPanel.tsx",
    "src/app/features/tasks/index.ts",
    "src/app/features/budget/index.ts",
    "src/app/features/invitations/index.ts",
    "src/app/features/project-access/index.ts",
  ]) expect(modules.has(path.resolve(file)), file).toBe(false);
});

it("opens the workflow guide without importing the task workspace through onboarding", () => {
  const modules = startupModules("src/app/features/authentication/workflow-preview/WorkflowPreviewPanel.tsx");
  for (const file of [
    "src/app/features/onboarding/components/OnboardingWorkspace.tsx",
    "src/app/features/tasks/index.ts",
    "src/app/features/budget/index.ts",
  ]) expect(modules.has(path.resolve(file)), file).toBe(false);
});
