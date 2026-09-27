import { Close, Save, Search } from '@carbon/icons-react';
import { FeatureDialog } from '../../../../components/ui/FeatureDialog';
import { councilorAvatars, drawerItemTypes, groupOrder } from './agendaModel';

interface AgendaItemDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  drawerType: string;
  setDrawerType: (value: string) => void;
  drawerRef: string;
  setDrawerRef: (value: string) => void;
  drawerTitle: string;
  setDrawerTitle: (value: string) => void;
  drawerSponsor: string;
  setDrawerSponsor: (value: string) => void;
  drawerDuration: string;
  setDrawerDuration: (value: string) => void;
  drawerGroup: string;
  setDrawerGroup: (value: string) => void;
  handleAddItem: () => void;
}

export function AgendaItemDrawer(props: AgendaItemDrawerProps) {
  const { drawerOpen, setDrawerOpen, drawerType, setDrawerType, drawerRef, setDrawerRef, drawerTitle, setDrawerTitle, drawerSponsor, setDrawerSponsor, drawerDuration, setDrawerDuration, drawerGroup, setDrawerGroup, handleAddItem } = props;
  return (
    <FeatureDialog
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      title="Add Agenda Item"
      description="Add an item to the 142nd Regular Session agenda."
      showCloseButton={false}
      contentClassName="!inset-y-0 !left-auto !right-0 !top-auto !h-auto !max-h-none !w-full !max-w-[400px] !translate-x-0 !translate-y-0 !rounded-none !border-y-0 !border-r-0 max-sm:!left-0"
    >
      <div
        className="flex h-full w-full flex-col border-l border-neutral-200 bg-white"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-[16px] font-semibold text-neutral-900">Add Agenda Item</h3>
            <p className="text-[11px] font-normal text-neutral-500 mt-0.5">142nd Regular Session</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <Close size={16} className="text-neutral-500" />
          </button>
        </div>

        {/* Drawer Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Item Type */}
          <div>
            <label className="text-[11px] font-medium text-neutral-700 block mb-1.5">Item Type</label>
            <select
              value={drawerType}
              onChange={(e) => setDrawerType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-[12px] font-normal text-neutral-800 outline-none focus:border-blue-300 bg-white appearance-none"
            >
              {drawerItemTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Measure Tracking No */}
          <div>
            <label className="text-[11px] font-medium text-neutral-700 block mb-1.5">Measure Tracking No.</label>
            <div className="relative">
              <input
                type="text"
                value={drawerRef}
                onChange={(e) => setDrawerRef(e.target.value)}
                placeholder="e.g. ORD-2026-049"
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-[12px] font-['JetBrains_Mono',_'Fira_Code',_monospace] text-neutral-800 outline-none focus:border-blue-300 placeholder:text-neutral-400 placeholder:font-normal"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300" />
            </div>
            <p className="text-[9px] font-normal text-neutral-400 mt-1">Auto-completes from active measures database</p>
          </div>

          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-neutral-700 block mb-1.5">Title / Description</label>
            <textarea
              value={drawerTitle}
              onChange={(e) => setDrawerTitle(e.target.value)}
              placeholder="Full title of the agenda item…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-[12px] font-normal text-neutral-800 outline-none focus:border-blue-300 resize-none placeholder:text-neutral-400"
            />
          </div>

          {/* Sponsoring Councilor */}
          <div>
            <label className="text-[11px] font-medium text-neutral-700 block mb-1.5">Sponsoring Councilor</label>
            <select
              value={drawerSponsor}
              onChange={(e) => setDrawerSponsor(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-[12px] font-normal text-neutral-800 outline-none focus:border-blue-300 bg-white appearance-none"
            >
              <option value="">Select councilor…</option>
              {councilorAvatars.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            {drawerSponsor && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-semibold text-white">
                  {councilorAvatars.find(c => c.name === drawerSponsor)?.initials}
                </div>
                <span className="text-[11px] font-medium text-neutral-800">{drawerSponsor}</span>
              </div>
            )}
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="text-[11px] font-medium text-neutral-700 block mb-1.5">Estimated Duration</label>
            <input
              type="text"
              value={drawerDuration}
              onChange={(e) => setDrawerDuration(e.target.value)}
              placeholder="e.g. 15 mins"
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-[12px] font-normal text-neutral-800 outline-none focus:border-blue-300 placeholder:text-neutral-400"
            />
          </div>

          {/* Agenda Group */}
          <div>
            <label className="text-[11px] font-medium text-neutral-700 block mb-1.5">Agenda Group</label>
            <select
              value={drawerGroup}
              onChange={(e) => setDrawerGroup(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-[12px] font-normal text-neutral-800 outline-none focus:border-blue-300 bg-white appearance-none"
            >
              {groupOrder.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center gap-3 shrink-0 bg-neutral-50/50">
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-medium text-neutral-600 bg-white border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddItem}
            disabled={!drawerTitle.trim()}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-colors ${
              drawerTitle.trim()
                ? "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            <Save size={14} /> Save to Agenda
          </button>
        </div>
      </div>

    </FeatureDialog>
  );
}
