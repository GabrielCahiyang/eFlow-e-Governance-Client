import { describe, expect, it } from 'vitest';
import { ledipoOffice } from '../../src/app/features/administration/selectors/ledipoOffice';
import type { Organization } from '../../src/app/types';

const office = (id: string, name: string, slug = '', is_active = true) => ({id, name, slug, is_active} as Organization);
describe('LEDIPO account ownership', () => {
  it('selects the active LEDIPO record among external Offices', () => {
    expect(ledipoOffice([office('external','Engineering'), office('owner','LEDIPO')])?.id).toBe('owner');
    expect(ledipoOffice([office('owner','Local Economic Development and Investment Promotion Office')])?.id).toBe('owner');
  });
  it('does not guess when LEDIPO is missing, inactive or ambiguous', () => {
    expect(ledipoOffice([office('external','Engineering')])).toBeUndefined();
    expect(ledipoOffice([office('owner','LEDIPO','ledipo',false)])).toBeUndefined();
    expect(ledipoOffice([office('one','LEDIPO'),office('two','LEDIPO')])).toBeUndefined();
  });
});
