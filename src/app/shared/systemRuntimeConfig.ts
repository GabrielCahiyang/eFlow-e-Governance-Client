export interface RuntimeSystemSettings {
  organizationName: string;
  organizationSubtitle: string;
  supportEmail: string;
  dueSoonDays: number;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerMessage: string;
}

let runtimeConfig: RuntimeSystemSettings = {
  organizationName: "LEDIPO",
  organizationSubtitle: "",
  supportEmail: "",
  dueSoonDays: 3,
  maintenanceBannerEnabled: false,
  maintenanceBannerMessage: "",
};

export function setRuntimeSystemSettings(next: Partial<RuntimeSystemSettings>): void {
  runtimeConfig = {
    ...runtimeConfig,
    ...next,
    dueSoonDays:
      typeof next.dueSoonDays === "number" && Number.isFinite(next.dueSoonDays) && next.dueSoonDays >= 1
        ? next.dueSoonDays
        : runtimeConfig.dueSoonDays,
  };
}

export function getDueSoonWindowDays(): number {
  return runtimeConfig.dueSoonDays;
}

export function getExportBrandHeader(): string {
  const org = runtimeConfig.organizationName.trim();
  const sub = runtimeConfig.organizationSubtitle.trim();
  if (org && sub) return `eFlow · ${org} — ${sub}`;
  if (org) return `eFlow · ${org}`;
  return "eFlow";
}
