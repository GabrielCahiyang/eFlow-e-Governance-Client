// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {compatibilityWorkWorkerIds,deduplicateWorkPersonIds,displayedWorkContributorIds,eligibleWorkPeople,resolveWorkPersonName} from '../../src/app/features/nested-work/selectors/people';
import {WorkPeopleSummary} from '../../src/app/features/nested-work/components/WorkPeopleSummary';
import {WorkLeadField} from '../../src/app/features/nested-work/components/WorkLeadField';
import {WorkContributorsField} from '../../src/app/features/nested-work/components/WorkContributorsField';
import type {WorkActionAvailability,WorkPerson} from '../../src/app/features/nested-work/types';
import {selectWorkPeopleDisplay,resolveWorkPersonName as publicPersonName,displayedWorkContributorIds as publicContributorIds,eligibleWorkPeople as publicEligiblePeople,deduplicateWorkPersonIds as publicUniqueIds} from '../../src/app/features/nested-work';

afterEach(()=>cleanup());
const allowed:WorkActionAvailability={allowed:true,reason_code:null,disabledReason:null};
const denied:WorkActionAvailability={allowed:false,reason_code:'appointment_denied',disabledReason:'You do not have permission to appoint this Lead.'};
const people:WorkPerson[]=[
 {id:'lead',name:'Current Lead',eligible:true},
 {id:'member',name:'Selected Contributor',eligible:true},
 {id:'next',name:'Replacement Lead',eligible:true},
 {id:'guest',name:'Approved Guest',eligible:true,office:'other-office'},
 {id:'old',name:'Historical Person',eligible:false},
 {id:'unknown',name:'Unverified Person'},
];
const leadProps={leadId:'lead',contributorIds:['member','lead'],people,appointmentCapability:allowed,busy:false,onChange:vi.fn()};
const contributorProps={leadId:'lead',contributorIds:['member','lead'],people,contributorCapability:allowed,busy:false,onChange:vi.fn()};

describe('pure authorized people conversion',()=>{
 it.each([
  {lead:'lead',ids:[],display:[],workers:['lead']},
  {lead:'lead',ids:['lead'],display:[],workers:['lead']},
  {lead:'lead',ids:['member','lead'],display:['member'],workers:['member','lead']},
  {lead:'lead',ids:['member','lead','next','member','lead'],display:['member','next'],workers:['member','lead','next']},
  {lead:null,ids:['member','next'],display:['member','next'],workers:['member','next']},
  {lead:null,ids:[],display:[],workers:[]},
 ])('converts $ids with explicit Lead $lead',({lead,ids,display,workers})=>{
  const frozen=Object.freeze([...ids]);
  expect(displayedWorkContributorIds(lead,frozen)).toEqual(display);
  expect(compatibilityWorkWorkerIds(lead,frozen)).toEqual(workers);
  expect(frozen).toEqual(ids);
 });
 it('deduplicates without reordering, replacing or mutating canonical IDs',()=>{
  const ids=Object.freeze(['member','','lead','member','next']);
  expect(deduplicateWorkPersonIds(ids)).toEqual(['member','lead','next']);
  expect(ids).toEqual(['member','','lead','member','next']);
 });
 it('keeps names for ineligible history and handles missing/blank names',()=>{
  expect(resolveWorkPersonName(people,'old')).toBe('Historical Person');
  expect(resolveWorkPersonName(people,'missing')).toBe('Previously assigned person');
  expect(resolveWorkPersonName([{id:'blank',name:'  '}],'blank')).toBe('Previously assigned person');
 });
 it('selects only explicitly eligible directory people, including authorized guests',()=>{
  expect(eligibleWorkPeople(people).map(person=>person.id)).toEqual(['lead','member','next','guest']);
 });
 it('deduplicates eligible people and fails closed for conflicting eligibility',()=>{
  expect(eligibleWorkPeople([...people,people[0],{id:'next',name:'Expired replacement',eligible:false}]).map(person=>person.id)).toEqual(['lead','member','guest']);
 });
 it('retains existing former-Lead contribution during compatibility conversion',()=>{
  const oldWorkers=Object.freeze(['lead','member']);
  expect(compatibilityWorkWorkerIds('next',oldWorkers)).toEqual(['lead','member','next']);
  expect(displayedWorkContributorIds('next',oldWorkers)).toEqual(['lead','member']);
 });
 it('does not manufacture a contribution for an appointment-only historical Lead',()=>{
  expect(compatibilityWorkWorkerIds('next',['member'])).toEqual(['member','next']);
 });
});

describe('explicit Lead and contributor summary',()=>{
 it.each([
  {ids:['lead'],count:0},
  {ids:['member','lead'],count:1},
  {ids:['member','lead','next','member','lead'],count:2},
 ])('shows contributors separately with count $count',({ids,count})=>{
  render(<WorkPeopleSummary leadId="lead" contributorIds={ids} people={people}/>);
  expect(screen.getByText('Lead:')).toBeTruthy();
  expect(screen.getByText(`Contributors (${count}):`)).toBeTruthy();
  expect(screen.getAllByText(/Current Lead/)).toHaveLength(1);
  if(count)expect(within(screen.getByRole('list',{name:'Contributors'})).getAllByRole('listitem')).toHaveLength(count);
  else expect(screen.getByText('No contributors')).toBeTruthy();
 });
 it('does not appoint the first contributor when Lead is missing',()=>{
  render(<WorkPeopleSummary leadId={null} contributorIds={['member']} people={people}/>);
  expect(screen.getByText('Needs reassignment')).toBeTruthy();
  expect(screen.getByText('Selected Contributor')).toBeTruthy();
 });
 it('keeps historical names even when Lead and Contributors are now ineligible',()=>{
  render(<WorkPeopleSummary leadId="old" contributorIds={['old','missing']} people={people}/>);
  expect(screen.getByText(/Historical Person/)).toBeTruthy();
  expect(screen.getByText('Previously assigned person')).toBeTruthy();
  expect(screen.getByText('Contributors (1):')).toBeTruthy();
 });
 it('supports compact display without changing count or inferring appointment',()=>{
  render(<WorkPeopleSummary leadId="lead" contributorIds={['next','lead','member','next']} people={people} compact/>);
  expect(screen.getByText('Replacement Lead, Selected Contributor')).toBeTruthy();
  expect(screen.getByText('Contributors (2):')).toBeTruthy();
 });
});

describe('controlled Lead field',()=>{
 it('emits an explicit appointment and preserves original worker contribution',()=>{
  const onChange=vi.fn(),ids=Object.freeze(['member','lead','member']);
  render(<WorkLeadField {...leadProps} contributorIds={ids} onChange={onChange}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Appointed Lead'}),{target:{value:'next'}});
  expect(onChange).toHaveBeenCalledExactlyOnceWith('next',['member','lead']);
  expect(ids).toEqual(['member','lead','member']);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('lead');
 });
 it('does not add an old appointment-only Lead to the contribution list',()=>{
  const onChange=vi.fn();
  render(<WorkLeadField {...leadProps} contributorIds={['member']} onChange={onChange}/>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'next'}});
  expect(onChange).toHaveBeenCalledExactlyOnceWith('next',['member']);
 });
 it('never infers Lead from first worker and leaves unappointed planning explicit',()=>{
  render(<WorkLeadField {...leadProps} leadId={null}/>);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
  expect(screen.getByText('Needs reassignment')).toBeTruthy();
 });
 it('shows an ineligible current Lead but excludes it from replacement options',()=>{
  const onChange=vi.fn();
  render(<WorkLeadField {...leadProps} leadId="old" onChange={onChange}/>);
  expect((screen.getByRole('option',{name:'Historical Person · Previously assigned'}) as HTMLOptionElement).disabled).toBe(true);
  expect(screen.queryByRole('option',{name:'Unverified Person'})).toBeNull();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'old'}});
  expect(onChange).not.toHaveBeenCalled();
 });
 it('retains a missing-name current Lead as a disabled historical option',()=>{
  render(<WorkLeadField {...leadProps} leadId="missing"/>);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('missing');
  expect(screen.getByRole('option',{name:'Previously assigned person · Previously assigned'})).toBeTruthy();
 });
 it.each([denied,undefined,{allowed:true,reason_code:'branch_denied',disabledReason:'Malformed'} as WorkActionAvailability])('fails closed for absent, denied or inconsistent appointment capability',appointmentCapability=>{
  const onChange=vi.fn();
  render(<WorkLeadField {...leadProps} appointmentCapability={appointmentCapability} onChange={onChange}/>);
  expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'next'}});
  expect(onChange).not.toHaveBeenCalled();
 });
 it('keeps current values when appointment capability is revoked or the field is busy',()=>{
  const onChange=vi.fn(),view=render(<WorkLeadField {...leadProps} onChange={onChange}/>);
  view.rerender(<WorkLeadField {...leadProps} appointmentCapability={denied} onChange={onChange}/>);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('lead');
  expect(screen.getByText(denied.disabledReason!)).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'next'}});
  view.rerender(<WorkLeadField {...leadProps} busy onChange={onChange}/>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'next'}});
  expect(onChange).not.toHaveBeenCalled();
 });
 it('rechecks current directory eligibility after a replacement expires',()=>{
  const onChange=vi.fn(),view=render(<WorkLeadField {...leadProps} onChange={onChange}/>);
  view.rerender(<WorkLeadField {...leadProps} people={people.map(person=>person.id==='next'?{...person,eligible:false}:person)} onChange={onChange}/>);
  expect(screen.queryByRole('option',{name:'Replacement Lead'})).toBeNull();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'next'}});
  expect(onChange).not.toHaveBeenCalled();
 });
});

describe('controlled contributor field',()=>{
 it('deduplicates chips/count and excludes the explicit Lead from add/remove',()=>{
  render(<WorkContributorsField {...contributorProps} contributorIds={['member','lead','member']}/>);
  expect(screen.getByRole('group',{name:'Contributors (1)'})).toBeTruthy();
  expect(screen.getAllByRole('button',{name:'Remove contributor Selected Contributor'})).toHaveLength(1);
  expect(screen.queryByRole('button',{name:/contributor Current Lead/})).toBeNull();
 });
 it('searches only eligible project people, including approved guests',()=>{
  render(<WorkContributorsField {...contributorProps}/>);
  expect(screen.queryByRole('button',{name:'Add contributor Historical Person'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Add contributor Unverified Person'})).toBeNull();
  fireEvent.change(screen.getByRole('searchbox',{name:'Find people'}),{target:{value:'  APPROVED  '}});
  expect(screen.getByRole('button',{name:'Add contributor Approved Guest'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Add contributor Replacement Lead'})).toBeNull();
 });
 it('keeps selected historical/ineligible/missing people named until explicitly removed',()=>{
  const onChange=vi.fn();
  render(<WorkContributorsField {...contributorProps} contributorIds={['old','missing','lead']} onChange={onChange}/>);
  expect(screen.getByRole('button',{name:'Remove contributor Historical Person'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Previously assigned person'}));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(['old','lead']);
  expect(screen.getByRole('button',{name:'Remove contributor Previously assigned person'})).toBeTruthy();
 });
 it('adds/removes through controlled callbacks without mutating frozen input arrays',()=>{
  const onChange=vi.fn(),ids=Object.freeze(['member','lead']);
  render(<WorkContributorsField {...contributorProps} contributorIds={ids} onChange={onChange}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));
  expect(onChange).toHaveBeenLastCalledWith(['member','lead','next']);
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Selected Contributor'}));
  expect(onChange).toHaveBeenLastCalledWith(['lead']);
  expect(ids).toEqual(['member','lead']);
  expect(screen.getByRole('button',{name:'Remove contributor Selected Contributor'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Add contributor Replacement Lead'})).toBeTruthy();
 });
 it.each([{ids:[]},{ids:['lead']}])('shows zero distinct contributors for $ids',({ids})=>{
  render(<WorkContributorsField {...contributorProps} contributorIds={ids}/>);
  expect(screen.getByRole('group',{name:'Contributors (0)'})).toBeTruthy();
  expect(screen.getByText('No contributors')).toBeTruthy();
 });
 it.each([denied,undefined])('blocks changes when contributor permission is unavailable',contributorCapability=>{
  const onChange=vi.fn();
  render(<WorkContributorsField {...contributorProps} contributorCapability={contributorCapability} onChange={onChange}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Selected Contributor'}));
  expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
 });
 it('keeps selected values across a current eligibility/capability refresh and busy state',()=>{
  const onChange=vi.fn(),view=render(<WorkContributorsField {...contributorProps} onChange={onChange}/>);
  const expired=people.map(person=>person.id==='member'||person.id==='next'?{...person,eligible:false}:person);
  view.rerender(<WorkContributorsField {...contributorProps} people={expired} contributorCapability={undefined} onChange={onChange}/>);
  expect(screen.getByRole('button',{name:'Remove contributor Selected Contributor'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Add contributor Replacement Lead'})).toBeNull();
  view.rerender(<WorkContributorsField {...contributorProps} busy onChange={onChange}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Selected Contributor'}));
  expect(onChange).not.toHaveBeenCalled();
 });
 it('does not turn contributor permission into Lead appointment permission',()=>{
  const appointment=vi.fn(),contributions=vi.fn();
  render(<><WorkLeadField {...leadProps} appointmentCapability={denied} onChange={appointment}/><WorkContributorsField {...contributorProps} onChange={contributions}/></>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'next'}});
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));
  expect(appointment).not.toHaveBeenCalled();
  expect(contributions).toHaveBeenCalledExactlyOnceWith(['member','lead','next']);
 });
 it('composes a controlled transfer, retains old workers, and removes them only explicitly',()=>{
  function Controlled(){
   const [leadId,setLeadId]=useState<string|null>('lead'),[ids,setIds]=useState(['lead','member']);
   return <><WorkLeadField {...leadProps} leadId={leadId} contributorIds={ids} onChange={(lead,retained)=>{setLeadId(lead);setIds(retained);}}/>
    <WorkContributorsField {...contributorProps} leadId={leadId} contributorIds={ids} onChange={setIds}/>
    <output aria-label="Compatibility workers">{compatibilityWorkWorkerIds(leadId,ids).join(',')}</output></>;
  }
  render(<Controlled/>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'next'}});
  expect(screen.getByRole('status',{name:'Compatibility workers'}).textContent).toBe('lead,member,next');
  expect(screen.getByRole('group',{name:'Contributors (2)'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:/contributor Replacement Lead/})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Current Lead'}));
  expect(screen.getByRole('status',{name:'Compatibility workers'}).textContent).toBe('member,next');
 });
});
describe('NW9.1 public people display adapter',()=>{
 it('counts an explicit Lead once even when absent from compatibility workers',()=>{
  const workers=Object.freeze(['member','member','']);
  expect(selectWorkPeopleDisplay('lead',workers,people)).toEqual({leadId:'lead',leadName:'Current Lead',
   contributors:[{id:'member',name:'Selected Contributor'}],participantIds:['lead','member']});
  expect(workers).toEqual(['member','member','']);
  expect(selectWorkPeopleDisplay('lead',['member','lead','lead'],people).participantIds).toEqual(['lead','member']);
 });
 it('does not infer appointment and resolves only supplied historical names',()=>{
  expect(selectWorkPeopleDisplay(null,['member'],people)).toMatchObject({leadId:null,leadName:null,participantIds:['member']});
  expect(selectWorkPeopleDisplay('old',['old','missing'],people)).toEqual({leadId:'old',leadName:'Historical Person',
   contributors:[{id:'missing',name:'Previously assigned person'}],participantIds:['old','missing']});
  expect(selectWorkPeopleDisplay('lead',[],[]).leadName).toBe('Previously assigned person');
 });
 it('exports the existing selectors without duplicating eligibility or worker rules',()=>{
  expect(publicPersonName).toBe(resolveWorkPersonName);
  expect(publicContributorIds).toBe(displayedWorkContributorIds);
  expect(publicEligiblePeople).toBe(eligibleWorkPeople);
  expect(publicUniqueIds).toBe(deduplicateWorkPersonIds);
 });
});
