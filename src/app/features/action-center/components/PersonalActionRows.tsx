import type { ActionItem } from '../selectors';

export function PersonalActionRows({ items, onOpen }: { items: ActionItem[]; onOpen: (item: ActionItem) => void }) {
  if (!items.length) return null;
  return <ul className="inbox-action-list rounded-lg border border-border divide-y divide-border bg-card">{items.map(item => {
    const kind = item.source === 'task-review' ? 'Task review' : 'Subtask review';
    return <li key={item.key}><button data-action-key={item.key} onClick={() => onOpen(item)} className="w-full text-left px-4 py-3 hover:bg-muted/50">
      <span className="block font-medium break-words">{item.title}</span>
      <span className="block text-xs text-muted-foreground mt-1 break-words">{kind}{item.context && item.context !== kind ? ` · ${item.context}` : ''}</span>
      <span className="inbox-action-list__open text-xs text-primary">Open review</span>
    </button></li>;
  })}</ul>;
}
