import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ShellNavigationItem } from './presentationNavigation';
import './personalWorkTools.css';

const workflowSections: Record<string, string> = {
  'Assigned work': 'tasks', Leading: 'leading', Subtasks: 'subtasks', History: 'history',
};
const toolLabels: Record<string, string> = {
  tasks: 'Task workspace', leading: 'Lead workspace', subtasks: 'Subtask workflow',
  deadlines: 'Deadline calendar', history: 'Task history details', performance: 'Performance', reports: 'Work Report',
};

/** Annotates authorized registry entries; aliases and already reachable Office tools stay out. */
export function getPersonalWorkTools(items: ShellNavigationItem[], destination: string, activeSection = 'personal_work') {
  const workflow = workflowSections[destination] || (Object.values(workflowSections).includes(activeSection) ? activeSection : undefined);
  return items.filter(item => item.group === 'my-work' && item.id !== activeSection &&
    (item.id === workflow || ['deadlines', 'performance', 'reports'].includes(item.id)))
    .flatMap(item => item.pages.slice(0, 1).map(page => ({ section: item.id, page: page.label, label: toolLabels[item.id] || item.label })));
}

export function PersonalWorkTools({ items, destination, activeSection = 'personal_work', onSelect, renderIcon }: {
  items: ShellNavigationItem[]; destination: string; activeSection?: string;
  onSelect: (section: string, page: string) => void;
  renderIcon?: (section: string, page: string) => ReactNode;
}) {
  const tools = getPersonalWorkTools(items, destination, activeSection);
  if (!tools.length) return null;
  return <details className="eflow-personal-tools">
    <summary><span>More work tools</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <div>{tools.map(tool => <button key={tool.section} type="button" className="eflow-workspace-navigation__destination" onClick={() => onSelect(tool.section, tool.page)}>
      {renderIcon?.(tool.section, tool.page)}<span>{tool.label}</span>
    </button>)}</div>
  </details>;
}
