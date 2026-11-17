/** Keep URLs, saved destinations, and notification links on the existing page keys. */
export function pageDisplayLabel(section: string, page: string): string {
  return section === 'personal_work' && page === 'Leading' ? 'Work I lead' : page;
}
