import * as React from "react";

export interface ContextMenuState {
  x: number;
  y: number;
  orgId?: string;
}

export function ContextMenu({
  menu,
  onClose,
  onAddChild,
  onEdit,
  onAssignHead,
  onDelete,
  canDelete,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onAddChild: () => void;
  onEdit: () => void;
  onAssignHead: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  React.useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (event.button > 0) return;

      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.context-menu')) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Capture phase is deliberate: React Flow consumes some pointer events
    // while panning/selecting nodes, but a normal left click must still close
    // this menu.
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('pointerdown', handler, true);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  return (
    <div
      className="context-menu fixed z-50 bg-white rounded-xl border border-neutral-200 shadow-lg py-1 min-w-[180px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.orgId && (
        <>
          <button
            onClick={() => { onAddChild(); onClose(); }}
            className="w-full text-left px-3 py-2 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer flex items-center gap-2"
          >
            <span className="text-[14px]">+</span> Add child dept
          </button>
          <button
            onClick={() => { onEdit(); onClose(); }}
            className="w-full text-left px-3 py-2 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer flex items-center gap-2"
          >
            <span className="text-[14px]">✏️</span> Edit
          </button>
          <button
            onClick={() => { onAssignHead(); onClose(); }}
            className="w-full text-left px-3 py-2 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer flex items-center gap-2"
          >
            <span className="text-[14px]">👤</span> Assign leadership
          </button>
          <div className="border-t border-neutral-100 my-1" />
          <button
            onClick={() => { onDelete(); onClose(); }}
            disabled={!canDelete}
            className={`w-full text-left px-3 py-2 text-[12px] font-medium cursor-pointer flex items-center gap-2
              ${canDelete ? 'text-red-600 hover:bg-red-50' : 'text-neutral-300 cursor-not-allowed'}`}
          >
            <span className="text-[14px]">🗑</span> Delete
          </button>
        </>
      )}
      {!menu.orgId && (
        <button
          onClick={() => { onAddChild(); onClose(); }}
          className="w-full text-left px-3 py-2 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer flex items-center gap-2"
        >
          <span className="text-[14px]">+</span> Add office
        </button>
      )}
    </div>
  );
}

// ─── Add/Edit Org Modal ──────────────────────────────────────────
