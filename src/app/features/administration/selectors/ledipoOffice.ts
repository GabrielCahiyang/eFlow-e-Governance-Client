import type { Organization } from '../../../types';

/** Resolve the owning Office without silently choosing a different department. */
export function ledipoOffice(organizations: Organization[]): Organization | undefined {
  const matches = organizations.filter(office => office.is_active && (
    office.slug?.toLowerCase() === 'ledipo' || /\bledipo\b/i.test(office.name)
    || /^local economic development (and|&) investment(s)?( promotion)? office$/i.test(office.name.trim())
  ));
  return matches.length === 1 ? matches[0] : undefined;
}
