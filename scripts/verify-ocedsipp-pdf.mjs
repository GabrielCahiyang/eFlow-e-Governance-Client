// Read-only acceptance check against the user's PDF using the production parsers.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { posix } from "node:path";
import ts from "typescript";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function pureModuleUrl(path) {
  const source = await readFile(new URL("../" + path, import.meta.url), "utf8");
  let code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  for (const match of [...code.matchAll(/from\s+["'](\.[^"']+)["']/g)]) {
    const dependency = posix.normalize(
      posix.join(posix.dirname(path), match[1] + ".ts"),
    );
    code = code.replace(
      match[0],
      `from ${JSON.stringify(await pureModuleUrl(dependency))}`,
    );
  }
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const pureModule = async (path) => import(await pureModuleUrl(path));
const layout = await pureModule(
  "src/app/features/proposal-import/services/pdfLayout.ts",
);
const budgetParser = await pureModule(
  "src/app/features/proposal-import/services/sourceBudget.ts",
);
const sections = await pureModule(
  "src/app/features/proposal-import/services/decomposition/textAnalysis.ts",
);
const input = process.argv[2] || "Project-Proposal-OCEDSIPP-Final-Version.pdf";
const bytes = await readFile(input),
  pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
try {
  const texts = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n),
      { items } = await page.getTextContent(),
      ops = await page.getOperatorList(),
      rules = [];
    ops.fnArray.forEach((fn, i) => {
      const b = ops.argsArray[i]?.[2];
      if (fn === pdfjs.OPS.constructPath && b?.length === 4)
        rules.push(Array.from(b));
    });
    const text = items.filter((item) => "str" in item);
    texts.push(
      layout.readingOrderText(text) +
        layout.budgetTableText(text, rules, n) +
        layout.workTableText(text, rules),
    );
  }
  const source = texts.join("\n\n"),
    budget = budgetParser.readSourceBudget(source),
    parts = sections.extractPartSections(source);
  if (
    !budget ||
    budget.total !== 2156500 ||
    budget.lines.length !== 16 ||
    parts?.length !== 8
  )
    throw new Error(
      "OCEDSIPP source acceptance does not match its reviewed baseline.",
    );
  console.log(
    JSON.stringify(
      {
        sha256: createHash("sha256").update(bytes).digest("hex"),
        pages: pdf.numPages,
        title: sections.extractProposalTitle(source, input),
        total: budget.total,
        lineCount: budget.lines.length,
        funds: [...new Set(budget.lines.map((line) => line.fundSource))].map(
          (name) => ({
            name,
            amount: budget.lines
              .filter((line) => line.fundSource === name)
              .reduce((sum, line) => sum + line.amount, 0),
          }),
        ),
        phases: parts.map((part) => ({
          title: part.title,
          schedule: part.schedule,
          description: part.description,
          tasks: part.sourceActions,
        })),
        budgetLines: budget.lines,
      },
      null,
      2,
    ),
  );
} finally {
  await pdf.destroy();
}
