import { readdirSync, readFileSync } from "node:fs";
import { readFile } from 'node:fs/promises';
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const presentationExtensions = new Set([".ts", ".tsx", ".css"]);

function collectPresentationFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return collectPresentationFiles(absolutePath);
    return presentationExtensions.has(extname(entry.name)) ? [absolutePath] : [];
  });
}

describe("redesign foundation", () => {
  it("does not reintroduce the retired Lexend or Montserrat presentation fonts", async () => {
    const applicationFiles = [
      ...collectPresentationFiles(sourceRoot),
      join(process.cwd(), "index.html"),
    ];
    const violations: string[] = [];
    // Bound I/O concurrency while allowing OneDrive reads to progress without
    // blocking the worker for thousands of synchronous file opens.
    for (let offset = 0; offset < applicationFiles.length; offset += 16) {
      const batch = applicationFiles.slice(offset, offset + 16);
      const texts = await Promise.all(batch.map(file => readFile(file, 'utf8')));
      batch.forEach((file, index) => { if (/Lexend|Montserrat/.test(texts[index])) violations.push(file); });
    }

    expect(violations).toEqual([]);
  });

  it("keeps Vibe tokens, Figtree loading, and global box sizing at the root", () => {
    const entrypoint = readFileSync(join(sourceRoot, "main.tsx"), "utf8");
    const styles = readFileSync(join(sourceRoot, "styles", "index.css"), "utf8");
    const tokens = readFileSync(join(sourceRoot, "styles", "foundation-tokens.css"), "utf8");

    expect(entrypoint).toContain('import "@vibe/core/tokens"');
    expect(entrypoint).toContain('@fontsource-variable/figtree/wght.css');
    expect(styles).toContain("box-sizing: border-box");
    expect(tokens).toContain("Figtree Variable");
    expect(styles).toContain("@import './foundation-tokens.css'");
  });

  it("keeps the application motion policy user-aware", () => {
    const provider = readFileSync(join(sourceRoot, "app", "shared", "motion", "EflowMotionProvider.tsx"), "utf8");
    expect(provider).toContain('reducedMotion = "user"');
    expect(provider).toContain("<MotionConfig reducedMotion={reducedMotion}>");
    expect(provider).toContain("LazyMotion");
  });
});
