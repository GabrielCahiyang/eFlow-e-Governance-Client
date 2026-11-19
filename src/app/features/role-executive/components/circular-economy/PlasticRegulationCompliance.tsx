import * as React from "react";
import * as Carbon from "@carbon/icons-react";
import * as UI from "../TransformPrimitives";
import { businessRegistry } from "./data";

export function PlasticRegulationCompliance() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState<string | null>(null);

  const filtered = businessRegistry.filter((b) => {
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = !zoneFilter || b.zone === zoneFilter;
    return matchesSearch && matchesZone;
  });

  const zones = [...new Set(businessRegistry.map(b => b.zone))];
  const passedCount = businessRegistry.filter(b => b.status === "Passed").length;

  return (
    <div>
      <UI.PageHeader
        title="City Ordinance Enforcement"
        subtitle="Marine Litter & Circular Economy · Plastic Regulation"
        actions={<>
          <div className="relative">
            <Carbon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search business..."
              maxLength={120}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 border border-neutral-200 rounded-lg text-[12px] font-normal text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-blue-100 w-48"
            />
          </div>
          <UI.Btn icon={<Carbon.Download size={14} />} label="Export Registry" />
        </>}
      />
      <div className="flex gap-3 mb-5 flex-wrap">
        <UI.StatCard label="Registered Businesses" value={`${businessRegistry.length}`} sub="In enforcement registry" />
        <UI.StatCard label="Passed" value={`${passedCount}`} sub={`${Math.round((passedCount / businessRegistry.length) * 100)}% compliance`} trend="up" />
        <UI.StatCard label="Warnings Issued" value="3" sub="Pending correction" />
        <UI.StatCard label="Fines Collected" value="₱48K" sub="2 businesses fined" trend="down" />
      </div>

      {/* RLS Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 flex items-center gap-2">
        <Carbon.Security size={14} className="text-blue-600" />
        <p className="text-[11px] font-normal text-blue-700">
          <strong>Row-Level Security:</strong> BPLO inspectors see only their assigned zones. ENRO Head has city-wide visibility. Current view: <strong>ENRO Head (All Zones)</strong>
        </p>
      </div>

      {/* Zone filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setZoneFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all ${!zoneFilter ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"}`}
        >All Zones</button>
        {zones.map((z) => (
          <button key={z} onClick={() => setZoneFilter(zoneFilter === z ? null : z)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all ${zoneFilter === z ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"}`}
          >{z}</button>
        ))}
      </div>

      {/* Audit Registry Table */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100">
              {["Business Name", "Zone", "Last Inspection", "Violations", "Inspector", "Status"].map((h) => (
                <th key={h} className="py-2.5 px-3 text-[11px] font-medium text-neutral-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.name} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                <td className="py-3 px-3 text-[12px] font-medium text-neutral-900">{b.name}</td>
                <td className="py-3 px-3 text-[11px] font-normal text-neutral-600">{b.zone}</td>
                <td className="py-3 px-3 text-[11px] font-normal text-neutral-600">{b.lastInspection}</td>
                <td className="py-3 px-3">
                  {b.violations > 0 ? (
                    <span className="text-[12px] font-medium text-red-600">{b.violations}</span>
                  ) : (
                    <span className="text-[12px] font-normal text-neutral-400">0</span>
                  )}
                </td>
                <td className="py-3 px-3 text-[11px] font-normal text-neutral-600">{b.inspector}</td>
                <td className="py-3 px-3"><UI.Pill status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== 3.2C TRASH TRAP INTERCEPTION RATES ====================
