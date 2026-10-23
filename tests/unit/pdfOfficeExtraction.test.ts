import {describe,it,expect,vi} from 'vitest';
const ai=vi.hoisted(()=>({chat:vi.fn()}));
vi.mock('../../src/app/features/ai',()=>({requestAiChat:ai.chat,readAiText:(response:any)=>response.message.content}));
import {parsePdfOffices,officeAliases,officeSourceChunks,mergeOfficeExtractions,extractPdfOffices} from '../../src/app/features/project-import/services/pdfOffices';
import type {ProjectImportDraft} from '../../src/app/features/project-import/types';
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
 it('bounds a long source without losing its tail or boundary context',()=>{
  const document='Context sentence. '.repeat(700)+' CPDO coordinates the final workshop.';
  const chunks=officeSourceChunks(document);
  expect(chunks.length).toBeGreaterThan(1);expect(chunks.every(chunk=>chunk.length<=3200)).toBe(true);
  expect(chunks.at(-1)).toContain('CPDO coordinates the final workshop.');
  for(let i=1;i<chunks.length;i++)expect(chunks[i].slice(0,500)).toBe(chunks[i-1].slice(-500));
 });
 it('merges repeated aliases and never chooses between conflicting task offices',()=>{
  const first=parsePdfOffices(JSON.stringify({offices:[{key:'a',name:'CPDO',kind:'responsible',evidence:'CPDO is a project implementing partner.'}],taskOffices:{t:'a'},taskEvidence:{t:'CPDO leads Prepare meeting.'}}),source,['t'],{t:'Prepare meeting'});
  const second={offices:[{key:'office-1',name:'City Planning and Development Office',evidence:'City Planning and Development Office coordinates the plan.',officeId:'',confirmed:false},{key:'office-2',name:'Other Office',evidence:'Other Office coordinates the plan.',officeId:'',confirmed:false}],taskOffices:{t:'office-2'},clarification:[]};
  const merged=mergeOfficeExtractions([first,second,first]);
  expect(merged.offices).toHaveLength(2);expect(merged.taskOffices).toEqual({});expect(merged.clarification).toEqual(['Check responsible office for t']);
 });
 it('sends bounded sequential requests with distinct retry identities and validates source evidence',async()=>{
  ai.chat.mockReset().mockResolvedValue({message:{content:JSON.stringify({offices:[{key:'a',name:'CPDO',kind:'responsible',evidence:'CPDO is a project implementing partner.'}]})}});
  const document='Context sentence. '.repeat(500)+source;
  const result=await extractPdfOffices(document,{groups:[{tasks:[{key:'t',title:'Prepare meeting'}]}]} as ProjectImportDraft,'saved-session',vi.fn());
  expect(result.offices).toHaveLength(1);expect(ai.chat.mock.calls.length).toBe(officeSourceChunks(document).length);
  expect(ai.chat.mock.calls.every(([request])=>request.pdf_office_extraction.document.length<=3200)).toBe(true);
  expect(ai.chat.mock.calls.every(([request])=>request.pdf_office_extraction.schemaVersion===1)).toBe(true);
  const ids=ai.chat.mock.calls.map(([,options])=>options.requestId);expect(new Set(ids).size).toBe(ids.length);
  expect(ids[0]).toContain('saved-session:office-schema-v3:0:0');
 });
});
