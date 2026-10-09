import { useEffect, useState } from 'react';

export const workspaceSectionIds = ['office-tools', 'favorites', 'projects', 'archived'] as const;
export type WorkspaceSectionId = typeof workspaceSectionIds[number];
export interface WorkspacePanelPreference {
  version: 2;
  sections: WorkspaceSectionId[];
  closed: WorkspaceSectionId[];
  collapsed: boolean;
}
const defaults: WorkspacePanelPreference = { version: 2, sections: [...workspaceSectionIds], closed: [], collapsed: false };
const validIds = (value: unknown): WorkspaceSectionId[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is WorkspaceSectionId => workspaceSectionIds.includes(id)))] : [];

export function parseWorkspacePanelPreference(value: unknown): WorkspacePanelPreference {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 2) return defaults;
  const record = value as Partial<WorkspacePanelPreference>;
  return { version: 2, sections: Array.isArray(record.sections) ? validIds(record.sections) : defaults.sections,
    closed: validIds(record.closed), collapsed: record.collapsed === true };
}

/** Device-local display choices, never a workspace membership or authorization grant. */
export function useWorkspacePanelPreference(userId: string, workspaceId: string) {
  const key = `eflow:navigation:v1:${userId}:${workspaceId}:panel-v2`;
  const [stored, setStored] = useState({ key: '', value: defaults });
  useEffect(() => {
    const read = () => {
      let value = defaults;
      try {
        const raw = localStorage.getItem(key);
        if (raw) value = parseWorkspacePanelPreference(JSON.parse(raw));
        else {
          const legacy: unknown = JSON.parse(localStorage.getItem(`eflow:navigation:v1:${userId}:${workspaceId}:disclosures`) || '[]');
          value = { ...defaults, closed: validIds(legacy) };
        }
      } catch { /* Use validated defaults when storage is blocked or malformed. */ }
      setStored({ key, value });
    };
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    read(); window.addEventListener('storage', storage);
    return () => window.removeEventListener('storage', storage);
  }, [key, userId, workspaceId]);
  const value = stored.key === key ? stored.value : defaults;
  const update = (next: WorkspacePanelPreference) => {
    const validated = parseWorkspacePanelPreference(next);
    setStored({ key, value: validated });
    try { if (userId) localStorage.setItem(key, JSON.stringify(validated)); } catch { /* Keep in memory. */ }
  };
  return { value, setCollapsed: (collapsed: boolean) => update({ ...value, collapsed }),
    toggleSection: (id: WorkspaceSectionId) => update({ ...value, sections: value.sections.includes(id)
      ? value.sections.filter(section => section !== id) : [...value.sections, id] }),
    toggleDisclosure: (id: WorkspaceSectionId) => update({ ...value, closed: value.closed.includes(id)
      ? value.closed.filter(section => section !== id) : [...value.closed, id] }) };
}
