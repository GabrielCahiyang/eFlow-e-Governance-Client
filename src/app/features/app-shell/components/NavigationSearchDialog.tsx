import { EmptyState } from '../../../components/ui/EmptyState';
import { useState } from 'react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { searchNavigation, type ShellNavigationItem } from '../../navigation';

export function NavigationSearchDialog({ items, projects, loading, onClose, onSelect, returnFocusTarget }: {
  items: ShellNavigationItem[]; projects: { id: string; title: string }[]; loading?: boolean; onClose: () => void;
  onSelect: (section: string, page: string, projectId?: string) => void;
  returnFocusTarget?: HTMLElement | null;
}) {
  const [query, setQuery] = useState('');
  const results = searchNavigation(query, items, projects);
  return <FeatureDialog title="Find pages and projects" description="Authorized pages and loaded projects only." onClose={onClose} contentClassName="eflow-navigation-search" onCloseAutoFocus={event => { if (returnFocusTarget?.isConnected) { event.preventDefault(); returnFocusTarget.focus(); } }}>
    <div className="eflow-navigation-search__header"><FormField label="Search navigation and projects"><TextInput autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a page or project…" /></FormField></div>
    <div className="eflow-navigation-search__results eflow-scroll-region" aria-label="Search results" aria-live="polite">
      {loading && <p role="status">Projects are still loading. Available pages can be searched now.</p>}
      {!query.trim() ? <p>Type a page or project name.</p> : !results.length ? <EmptyState illustration="search" size="compact" title="No matches in your available content."/> : results.map(result => <button type="button" key={result.id} onClick={() => onSelect(result.section, result.page, result.projectId)}><span>{result.title}</span><small>{result.kind}</small></button>)}
      {results.length === 50 && <p>Showing the first 50 matches. Refine your search for more.</p>}
    </div>
  </FeatureDialog>;
}
