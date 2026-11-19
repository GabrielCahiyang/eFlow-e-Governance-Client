import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SRC_DIR = path.join(ROOT, "src");

const NON_TEXT_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "hidden",
  "submit",
  "button",
  "color",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
  "range",
]);

/**
 * Shared primitives that enforce their own default bounds internally
 * (DateInput, MoneyInput, SearchInput, Input, Textarea, TextInput, SidebarInput).
 */
const SELF_BOUNDED_COMPONENTS = new Set(["MoneyInput", "SearchInput"]);

const TAG_START_RE = /<(input|textarea|Input|Textarea|TextInput|TextField|TextArea|MoneyInput|SearchInput)\b/g;

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function readTagText(source: string, start: number): string {
  let i = start;
  let braceDepth = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\" && i + 1 < source.length) {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "{") {
      braceDepth += 1;
    } else if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (ch === ">" && braceDepth === 0) {
      return source.slice(start, i + 1);
    }
    i += 1;
  }
  return source.slice(start, Math.min(source.length, start + 400));
}

function getAttr(tagText: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`).exec(tagText);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

describe("System-wide input validation bounds audit", () => {
  it("enforces explicit maxLength or numeric max/min bounds on every data-entry and search input across src/", () => {
    const files = walkTsx(SRC_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const source = fs.readFileSync(file, "utf8");
      TAG_START_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TAG_START_RE.exec(source)) !== null) {
        const tag = match[1];
        if (SELF_BOUNDED_COMPONENTS.has(tag)) continue;

        const tagText = readTagText(source, match.index);
        const typeAttr = (getAttr(tagText, "type") ?? "").toLowerCase();
        if (NON_TEXT_TYPES.has(typeAttr)) continue;

        // UI wrapper primitives forward {...props} with internal defaults.
        if (
          rel === "src/app/components/ui/input.tsx" ||
          rel === "src/app/components/ui/textarea.tsx" ||
          rel === "src/app/components/ui/FormField.tsx" ||
          rel === "src/app/components/ui/DateInput.tsx" ||
          rel === "src/app/components/ui/MoneyInput.tsx" ||
          rel === "src/app/components/ui/sidebar.tsx"
        ) {
          continue;
        }

        const hasMaxLength = /\bmaxLength\s*=/.test(tagText);
        const hasNumericMax = typeAttr === "number" && /\bmax\s*=/.test(tagText);
        const isBounded = hasMaxLength || hasNumericMax;

        if (!isBounded) {
          const line = source.slice(0, match.index).split("\n").length;
          violations.push(`${rel}:${line} <${tag}${typeAttr ? ` type="${typeAttr}"` : ""}> missing maxLength / max bound`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
