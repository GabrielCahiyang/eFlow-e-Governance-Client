import { Settings } from "@carbon/icons-react";
import { RolePageRouter, type RolePageSections } from "../../components/Layout/RolePageRouter";
import { CouncilorPanel } from "./councilor";
import { committeePages, committeeDefaultPages } from "../../components/Legislative/CommitteeAffairsContent";
import { ActiveMeasuresPipeline } from "./components/ActiveMeasuresPipeline";
import { FirstReading } from "./components/FirstReading";
import { CommitteeLevel } from "./components/CommitteeLevel";
import { SecondReading } from "./components/SecondReading";
import { ThirdReading } from "./components/ThirdReading";
import { MayoralApproval } from "./components/MayoralApproval";
import { AdoptedOrdinancesArchive } from "./components/AdoptedOrdinancesArchive";
import { SemanticSearch } from "./components/SemanticSearch";
import { FullIndex } from "./components/FullIndex";

export const legislativePages: RolePageSections = {
  legdash: {
    "Active Measures Pipeline": ActiveMeasuresPipeline,
    "First Reading": FirstReading,
    "Committee Level": CommitteeLevel,
    "Second Reading": SecondReading,
    "Third Reading": ThirdReading,
    "Mayoral Approval": MayoralApproval,
    "Adopted Ordinances Archive": AdoptedOrdinancesArchive,
    "Semantic Search": SemanticSearch,
    "Full Index": FullIndex,
  },
  ...committeePages,
  councilor: {
    "Councilor Dashboard": CouncilorPanel,
  },
};

export const legislativeDefaultPages: Record<string, string> = {
  legdash: "Active Measures Pipeline",
  ...committeeDefaultPages,
  councilor: "Councilor Dashboard",
};

export function LegislativeContent({ activeSection, activePage }: { activeSection: string; activePage?: string }) {
  return <RolePageRouter sections={legislativePages} defaults={legislativeDefaultPages} activeSection={activeSection} activePage={activePage} fallback={(section) => <div className="flex h-full items-center justify-center text-neutral-400"><div className="text-center"><Settings size={40} className="mx-auto mb-3 opacity-30" /><p className="text-[14px]">Section unavailable</p><p className="mt-1 text-[12px]">{section}</p></div></div>} />;
}
