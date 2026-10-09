import { describe, expect, it } from 'vitest';
import { officeTableRows, filterOfficeTableRows } from '../../src/app/features/project-offices/officeTableRows';
import type { OfficeIdentity, ProjectOffice } from '../../src/app/features/project-offices/types';

const office = { id:'lead', office_id:'ledipo', project_id:'project', relationship_type:'lead', invitation_status:'joined', contact_email:'' } as ProjectOffice;
const named = { id:'named', display_name:'New Office', project_id:'project', canonical_office_id:null, project_office_id:null,
  relationship_type:'collaborating', contact_email:'contact@example.test', contact_status:'none', provenance:{source:'manual'} } as OfficeIdentity;
const name = (id:string) => id === 'ledipo' ? 'LEDIPO' : 'Directory Office';
const all = {query:'', relationship:'all', status:'all'};

describe('one Project Offices table', () => {
  it('shows named and directory Offices in the same list without inventing joined participation', () => {
    const rows = officeTableRows([office], [named], name, []);
    expect(rows.map(r => r.name)).toEqual(['LEDIPO','New Office']);
    expect(rows[1].statusLabel).toBe('Planning only');
    expect(rows[1].participation).toBeUndefined();
  });
  it('merges a linked identity into exactly one participation row and preserves source context', () => {
    const linked = {...named, canonical_office_id:'partner', project_office_id:'partner-row', provenance:{source:'reviewed_import',evidence:'Prepare the design'}};
    const backfill = {...linked,id:'backfill',display_name:'Directory Office',provenance:{source:'canonical_backfill'}};
    const partner = {...office,id:'partner-row',office_id:'partner',relationship_type:'collaborating' as const};
    const rows = officeTableRows([office,partner],[backfill,linked],name,[]);
    expect(rows).toHaveLength(2);
    expect(rows[1].identity?.id).toBe('named');
    expect(rows[1].identity?.provenance.evidence).toBe('Prepare the design');
    expect(rows[1].participation?.id).toBe('partner-row');
  });
  it('does not resurrect removed named Offices', () => {
    expect(officeTableRows([office],[{...named,provenance:{removed:true}}],name,[])).toHaveLength(1);
  });
  it('filters named Offices by name, contact, relationship and their actual planning status', () => {
    const rows = officeTableRows([office],[named],name,[]);
    for (const filters of [{...all,query:'new office'}, {...all,query:'CONTACT@'}, {...all,relationship:'collaborating'}, {...all,status:'planning'}])
      expect(filterOfficeTableRows(rows,filters).map(r => r.key)).toEqual(['named']);
    expect(filterOfficeTableRows(rows,{...all,status:'joined'}).map(r => r.key)).toEqual(['lead']);
  });
  it('keeps accepted contacts distinct from joined Offices and filters linked aliases', () => {
    const accepted = officeTableRows([office],[{...named,contact_status:'accepted'}],name,[]);
    expect(accepted[1].statusLabel).toBe('Contact accepted');
    expect(filterOfficeTableRows(accepted,{...all,status:'contact_accepted'})).toHaveLength(1);
    expect(filterOfficeTableRows(accepted,{...all,status:'joined'})).toHaveLength(1);
    const linked = officeTableRows([office],[{...named,project_office_id:'lead',canonical_office_id:'ledipo'}],name,[]);
    expect(filterOfficeTableRows(linked,{...all,query:'new office'})).toHaveLength(1);
  });
});
