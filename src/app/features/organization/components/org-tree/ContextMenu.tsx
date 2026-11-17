import * as React from "react";
import { Pencil, Plus, Trash2, UserCog } from "lucide-react";

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
      className="context-menu fixed z-50 min-w-[190px] rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] py-1 shadow-lg"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.orgId && (
        <>
          <button
            type="button"
            onClick={() => { onAddChild(); onClose(); }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[var(--eflow-text)] hover:bg-[var(--eflow-subtle)]"
          >
            <Plus size={15} aria-hidden="true" className="text-[var(--eflow-text-muted)]" /> Add child office
          </button>
          <button
            type="button"
            onClick={() => { onEdit(); onClose(); }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[var(--eflow-text)] hover:bg-[var(--eflow-subtle)]"
          >
            <Pencil size={15} aria-hidden="true" className="text-[var(--eflow-text-muted)]" /> Edit office
          </button>
          <button
            type="button"
            onClick={() => { onAssignHead(); onClose(); }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[var(--eflow-text)] hover:bg-[var(--eflow-subtle)]"
          >
            <UserCog size={15} aria-hidden="true" className="text-[var(--eflow-text-muted)]" /> Assign leadership
          </button>
          <div className="my-1 border-t border-[var(--eflow-border)]" />
          <button
            type="button"
            onClick={() => { onDelete(); onClose(); }}
            disabled={!canDelete}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium ${
              canDelete
                ? "cursor-pointer text-[var(--eflow-negative-text)] hover:bg-[var(--eflow-negative-bg)]"
                : "cursor-not-allowed text-[var(--eflow-text-muted)] opacity-50"
            }`}
          >
            <Trash2 size={15} aria-hidden="true" /> Delete
          </button>
        </>
      )}
      {!menu.orgId && (
        <button
          type="button"
          onClick={() => { onAddChild(); onClose(); }}
          className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[var(--eflow-text)] hover:bg-[var(--eflow-subtle)]"
        >
          <Plus size={15} aria-hidden="true" className="text-[var(--eflow-text-muted)]" /> Add office
        </button>
      )}
    </div>
  );
}

// ─── Add/Edit Org Modal ──────────────────────────────────────────
