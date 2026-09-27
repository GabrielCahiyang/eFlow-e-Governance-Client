import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sharedPrimitives = readFileSync("src/app/components/workflow/primitives.tsx", "utf8");
const settingsPrimitives = readFileSync("src/app/features/settings/components/settingsPrimitives.tsx", "utf8");
const settingsContent = readFileSync("src/app/features/settings/components/SettingsContent.tsx", "utf8");
const financePrimitives = readFileSync("src/app/features/role-finance/components/primitives.tsx", "utf8");
const legislativePrimitives = readFileSync("src/app/features/role-legislative/session/components/primitives.tsx", "utf8");

describe("feature primitive delegation", () => {
  it("provides a shared compact section heading alongside canonical workflow surfaces", () => {
    expect(sharedPrimitives).toContain("export function SectionHeading");
    expect(sharedPrimitives).toContain("rounded-[10px] border border-border bg-card");
    expect(sharedPrimitives).toContain('text-primary');
  });

  it("routes settings cards, headers, and loading states through workflow primitives", () => {
    expect(settingsPrimitives).toContain("Card as WorkflowCard");
    expect(settingsPrimitives).toContain("SectionHeading as WorkflowSectionHeading");
    expect(settingsPrimitives).toContain('<WorkflowCard bodyClassName="contents"');
    expect(settingsPrimitives).toContain("<WorkflowSectionHeading");
    expect(settingsPrimitives).toContain("<LoadingState label={label}");
    expect(settingsContent).toContain("<PageHeader");
    expect(settingsContent).toContain('bg-muted/30');
  });

  it("routes finance and legislative headers, buttons, and stats through workflow primitives", () => {
    for (const source of [financePrimitives, legislativePrimitives]) {
      expect(source).toContain("PageHeader as WorkflowPageHeader");
      expect(source).toContain("StatCard as WorkflowStatCard");
      expect(source).toContain("WButton");
      expect(source).toContain("<WorkflowPageHeader");
      expect(source).toContain("<WorkflowStatCard");
      expect(source).toContain("<WButton");
      expect(source).not.toContain("rounded-xl border border-neutral-200 bg-white");
    }
  });
});
