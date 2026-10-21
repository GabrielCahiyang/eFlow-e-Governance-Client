import {describe,it,expect} from 'vitest';
import {parsePdfOffices,officeAliases} from '../../src/app/features/project-import/services/pdfOffices';
const source='CPDO is a project implementing partner. City Planning and Development Office coordinates the plan. LEDIPO provides funding. Relevant LGU Offices participate. CPDO leads Prepare meeting.';
describe('verified Office extraction',()=>{
 it('groups abbreviations, excludes funders, flags vague names and verifies task evidence',()=>{
  const result=parsePdfOffices(JSON.stringify({offices:[{key:'a',name:'CPDO',kind:'responsible',evidence:'CPDO is a project implementing partner.'},{key:'b',name:'City Planning and Development Office',kind:'responsible',evidence:'City Planning and Development Office coordinates the plan.'},{key:'c',name:'LEDIPO',kind:'funding',evidence:'LEDIPO provides funding.'},{key:'d',name:'Relevant LGU Offices',kind:'responsible',evidence:'Relevant LGU Offices participate.'}],taskOffices:{t1:'a',t2:'a'},taskEvidence:{t1:'CPDO leads Prepare meeting.',t2:'Invented quote'}}),source,['t1','t2'],{t1:'Prepare meeting',t2:'Other task'});
  expect(result.offices).toHaveLength(1);expect(result.clarification).toEqual(['Relevant LGU Offices']);expect(result.taskOffices).toEqual({t1:'office-1'});
 });
 it('does not mistake a budget-only quote for responsibility',()=>{
  const result=parsePdfOffices(JSON.stringify({offices:[{key:'a',name:'CPDO',kind:'responsible',evidence:'CPDO 985,000'}]}),'CPDO 985,000',[]);
  expect(result.offices).toEqual([]);expect(result.clarification).toEqual(['CPDO']);
 });
 it('rejects invented source evidence',()=>{
  expect(()=>parsePdfOffices(JSON.stringify({offices:[{key:'a',name:'Fake Office',kind:'responsible',evidence:'Fake Office implements this.'}]}),source,[])).toThrow('verified');
 });
 it('does not treat a lead consultant budget line or funding partner as an implementing Office',()=>{
  for(const evidence of ['Lead Consultant CPDO 325,000','CPDO is the funding partner.']){
   const result=parsePdfOffices(JSON.stringify({offices:[{key:'a',name:'CPDO',kind:'responsible',evidence}]}),evidence,[]);
   expect(result.offices).toEqual([]);expect(result.clarification).toEqual(['CPDO']);
  }
 });
 it('recognizes a spelled-out LEDIPO alias',()=>expect(officeAliases('Local Economic Development and Investment Promotions Office (LEDIPO)')).toContain('ledipo'));
});
