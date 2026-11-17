import { WorkspaceTooltip } from "../../../../components/ui/workspace/WorkspaceTooltip";
import type { Organization } from '../../../../types';

export interface UndoItem {
  id: string;
  org: Organization;
  expiresAt: number;
}

interface UndoNotificationsProps {
  items: UndoItem[];
  onUndo: (item: UndoItem) => void;
  onDismiss: (id: string) => void;
}

export function UndoNotifications({ items, onUndo, onDismiss }: UndoNotificationsProps) {
  return (
    <>
{/* Stacked Undo Notifications */}
        <div className="absolute top-4 right-4 z-[100] flex flex-col gap-2.5 pointer-events-none w-80">
          {items.map((item) => (
            <div
              key={item.id}
              className="pointer-events-auto relative overflow-hidden bg-neutral-950/95 backdrop-blur-md border border-neutral-800 text-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] px-4 py-3 flex items-center justify-between gap-3 animate-[undo-slide-in_0.3s_ease-out] font-normal"
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Deleted</span>
                <span className="text-[13px] font-medium text-neutral-100 truncate block">
                  {item.org.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onUndo(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[11px] font-semibold cursor-pointer transition-all shadow-md shadow-blue-900/30"
                >
                  Undo
                </button>
                <WorkspaceTooltip content="Dismiss message"><button aria-label="Dismiss message"
                  onClick={() => onDismiss(item.id)}
                  className="text-neutral-400 hover:text-neutral-200 cursor-pointer p-1 rounded-md hover:bg-neutral-900 transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                  </svg>
                </button></WorkspaceTooltip>
              </div>

              {/* Progress/Timer Bar */}
              <div
                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-600 to-blue-400"
                style={{
                  animation: 'undo-shrink 30s linear forwards',
                  width: '100%'
                }}
              />
            </div>
          ))}
        </div>

        <style>{`
          @keyframes undo-shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
          @keyframes undo-slide-in {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
    </>
  );
}
