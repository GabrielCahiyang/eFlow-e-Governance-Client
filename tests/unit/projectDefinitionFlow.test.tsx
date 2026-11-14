// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({call:vi.fn(),read:vi.fn(),reload:vi.fn(),templates:vi.fn(),data:{} as any}));
vi.mock('../../src/app/features/project-setup/useProjectFlow',()=>({useProjectFlow:()=>({data:api.data,reload:api.reload,error:''})}));
vi.mock('../../src/app/features/project-setup/services/projectFlow',()=>({projectFlowCall:api.call,readProjectFlow:api.read,ProjectFlowError:class extends Error{}}));
vi.mock('../../src/app/shared/navigationGuard',()=>({useNavigationBlocker:vi.fn(),requestNavigation:async (action:()=>void)=>{action();return true;}}));
vi.mock('../../src/app/features/work-templates',()=>({listProjectTaskTemplates:api.templates}));
import {ProjectSetupWizard} from '../../src/app/features/project-setup/components/ProjectSetupWizard';
import {ProjectDefinitionPanel} from '../../src/app/features/project-setup/components/ProjectDefinitionPanel';
import {ProjectFlowError} from '../../src/app/features/project-setup/services/projectFlow';
import {TaskProjectFunding} from '../../src/app/features/project-setup/components/TaskProjectFunding';
import {ProjectFundingPanel} from '../../src/app/features/project-setup/components/ProjectFundingPanel';
const initial=()=>({project:{id:'p',title:'Community support',description:'',scope:'',project_lead_id:null,start_date:null,target_date:null,funding_not_required:false,updated_at:'2026-10-30T00:00:00Z'},ready:false,canAuthorize:true,canAllocate:true,funds:[],sources:[{id:'source',name:'Community services',year:2027,available:1000000}],requests:[],fundingRequests:[],taskFunding:[],liquidations:[],total:0,allocated:0,unallocated:0,released:0,spent:0});
const lead={id:'lead',full_name:'Ari Lead',email:'ari@example.test',role:'member' as const,is_active:true};
vi.setConfig({testTimeout:15000});
beforeEach(()=>{localStorage.clear();vi.resetAllMocks();api.data=initial();api.templates.mockResolvedValue([]);api.reload.mockResolvedValue(undefined);api.read.mockImplementation(async()=>api.data);});afterEach(cleanup);
it('keeps setup in a centered wizard, validates one section and retains entries',async()=>{
 render(<ProjectDefinitionPanel projectId="p" profiles={[]}/>);expect(screen.queryByLabelText('Description *')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Continue project setup'}));
 await screen.findByLabelText('Description *');fireEvent.click(screen.getByRole('button',{name:'Next'}));expect((await screen.findByRole('alert')).className).toBe('pf-error');fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'Keep this draft'}});fireEvent.click(screen.getByRole('button',{name:'Next'}));await screen.findByLabelText('Scope of the project *');expect(screen.queryByLabelText('Description *')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Back'}));expect((screen.getByLabelText('Description *') as HTMLTextAreaElement).value).toBe('Keep this draft');
});
it('restores the draft step and values in the same Office and account',async()=>{
 const props={recoveryKey:'actor-office',profiles:[],createDraft:vi.fn(),onClose:vi.fn(),onFinish:vi.fn()};
 const first=render(<ProjectSetupWizard {...props}/>);
 fireEvent.change(screen.getByLabelText('Project title *'),{target:{value:'Recovered project'}});
 fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'Objectives'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 fireEvent.change(await screen.findByLabelText('Scope of the project *'),{target:{value:'Workshop delivery'}});
 first.unmount();
 const other=render(<ProjectSetupWizard {...props} recoveryKey="other-office"/>);
 expect(screen.queryByRole('button',{name:'Continue draft'})).toBeNull();
 other.unmount();
 render(<ProjectSetupWizard {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 expect(screen.getByLabelText('Scope of the project *')).toHaveValue('Workshop delivery');
 expect(props.createDraft).not.toHaveBeenCalled();
});
it('retries an uncertain creation with the original request identity and payload',async()=>{
 const props={recoveryKey:'actor-office',profiles:[],createDraft:vi.fn().mockRejectedValue(new Error('Failed to fetch')),onClose:vi.fn(),onFinish:vi.fn()};
 const view=render(<ProjectSetupWizard {...props}/>);
 fireEvent.change(screen.getByLabelText('Project title *'),{target:{value:'Unconfirmed project'}});
 fireEvent.click(screen.getByRole('button',{name:'Save draft and close'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm project creation');
 view.unmount();
 render(<ProjectSetupWizard {...props}/>);
 expect(screen.getByRole('button',{name:'Start new project'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 fireEvent.click(screen.getByRole('button',{name:'Save draft and close'}));
 await waitFor(()=>expect(props.createDraft).toHaveBeenCalledTimes(2));
 expect(props.createDraft.mock.calls[1]).toEqual(props.createDraft.mock.calls[0]);
});
it('derives the funding total from source amounts without quarter selection',async()=>{
 api.data.sources.push({id:'source2',name:'Other services',year:2027,available:1000000});api.call.mockResolvedValue({authorized:700000});render(<ProjectFundingPanel data={api.data} reload={api.reload}/>);
 expect(screen.getByRole('button',{name:'Authorize project funding'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'300000'}});
 fireEvent.click(screen.getByRole('button',{name:'Add funding source'}));fireEvent.change(screen.getAllByLabelText('Office Budget source')[1],{target:{value:'source2'}});expect(screen.queryByLabelText('Quarter')).toBeNull();fireEvent.change(screen.getAllByRole('spinbutton')[1],{target:{value:'400000'}});
 expect(screen.getByText(/Additional funding total:/).textContent).toContain('700,000');fireEvent.change(screen.getByLabelText('Reason / approved authority reference'),{target:{value:'Approved annual work program'}});fireEvent.click(screen.getByRole('button',{name:'Authorize project funding'}));
 await waitFor(()=>expect(api.call).toHaveBeenCalledWith('authorize_project_funding',expect.objectContaining({p_lines:[{partitionId:'source',amount:300000},{partitionId:'source2',amount:400000}]})));
});
it('project lead requests authorization rather than reserving Office Budget directly',async()=>{
 api.call.mockResolvedValue('request');render(<ProjectFundingPanel data={{...api.data,canAuthorize:false}} reload={api.reload}/>);
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1000'}});fireEvent.change(screen.getByLabelText('Reason / approved authority reference'),{target:{value:'Additional workshop'}});fireEvent.click(screen.getByRole('button',{name:'Request funding'}));await waitFor(()=>expect(api.call.mock.calls[0][0]).toBe('request_project_funding'));
});

it('requires a reason in the funding release dialog and retains its request identity',async()=>{
 api.data.funds=[{id:'fund',name:'Community services',fiscal_year:2027,amount:500,available:500}];
 api.call.mockRejectedValueOnce(new Error('Result unavailable')).mockResolvedValueOnce('released');
 render(<ProjectFundingPanel data={api.data} reload={api.reload}/>);
 fireEvent.click(screen.getByRole('button',{name:'Release unused',exact:true}));
 const confirm=screen.getByRole('button',{name:'Release unused funding'});
 expect(confirm).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Reason (required)'),{target:{value:'Close out unspent funding'}});
 fireEvent.click(confirm);
 await screen.findByText('Result unavailable');
 fireEvent.click(confirm);
 await waitFor(()=>expect(api.call).toHaveBeenCalledTimes(2));
 expect(api.call.mock.calls[0]).toEqual(api.call.mock.calls[1]);
});

it('lets users skip directly to Review but prevents incomplete setup from finishing',async()=>{
 render(<ProjectSetupWizard recoveryKey="actor-office" createDraft={vi.fn()} profiles={[]} onClose={vi.fn()} onFinish={vi.fn()}/>);
 await screen.findByLabelText('Description *');fireEvent.click(screen.getByRole('button',{name:/05.*Review/}));
 expect(screen.getByText('Ready to build the work plan?')).toBeVisible();
 expect(screen.getByRole('button',{name:/06.*Add people/})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Next: Add people'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('title and description'));
 expect(api.call).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:/02.*Scope/}));expect(screen.getByLabelText('Scope of the project *')).toBeVisible();
});

it('keeps unsaved funding rows while jumping between sections',async()=>{
 api.data.project={...api.data.project,description:'Deliver support',scope:'Workshop materials',project_lead_id:'lead',start_date:'2027-01-01',target_date:'2027-12-31'};
 localStorage.setItem('actor-office',JSON.stringify({projectId:'p',step:3,creationPending:false,base:api.data.project,values:{title:api.data.project.title,description:api.data.project.description,scope:api.data.project.scope,lead:'lead',start:'2027-01-01',end:'2027-12-31',noFunding:false}}));
 render(<ProjectSetupWizard recoveryKey="actor-office" createDraft={vi.fn()} profiles={[lead] as any} onClose={vi.fn()} onFinish={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 fireEvent.change(screen.getByLabelText('Fiscal year'),{target:{value:'2027'}});
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234'}});
 fireEvent.click(screen.getByRole('button',{name:/02.*Scope/}));fireEvent.click(screen.getByRole('button',{name:/04.*Funding/}));
 expect(screen.getByRole('spinbutton')).toHaveValue('1,234');expect(screen.getByLabelText('Office Budget source')).toHaveValue('source');
 fireEvent.click(screen.getByRole('button',{name:/05.*Review/}));fireEvent.click(screen.getByRole('button',{name:'Next: Add people'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Save or remove the funding entries'));
 expect(api.call).not.toHaveBeenCalled();
});

it('prepares Funding automatically and authorizes a valid annual amount inside the wizard',async()=>{
 const createDraft=vi.fn().mockResolvedValue('p');
 api.data.sources.push({id:'outside-year',name:'Outside dates',year:2028,available:1000000});
 api.call.mockImplementation(async(operation,args)=>{
  if(operation==='save_project_definition'){
   const d=args.p_details;
   Object.assign(api.data.project,{title:d.title,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end});
   return api.data.project;
  }
  if(operation==='authorize_project_funding'){
   api.data.total=1234.56;
   api.data.funds.push({id:'fund',name:'Community services',fiscal_year:2027,amount:1234.56,available:1234.56});
   return {authorized:1234.56};
  }
 });
 render(<ProjectSetupWizard recoveryKey="actor-office" createDraft={createDraft} profiles={[lead] as any} onClose={vi.fn()} onFinish={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:/04.*Funding/}));
 expect(screen.getByText(/Complete Details, Scope/)).toBeVisible();
 expect(createDraft).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:/01.*Details/}));
 fireEvent.change(screen.getByLabelText('Project title *'),{target:{value:'Community support'}});
 fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'Deliver support'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 fireEvent.change(screen.getByLabelText('Scope of the project *'),{target:{value:'Training'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 fireEvent.change(screen.getByLabelText('Project Lead *'),{target:{value:'lead'}});
 fireEvent.change(screen.getByLabelText('Project start date *'),{target:{value:'2027-01-01'}});
 fireEvent.change(screen.getByLabelText('Project target date *'),{target:{value:'2027-06-30'}});
 fireEvent.click(screen.getByRole('button',{name:/04.*Funding/}));
 const authorize=await screen.findByRole('button',{name:'Authorize project funding'});
 await waitFor(()=>expect(screen.getByLabelText('Fiscal year')).toBeEnabled());
 expect(createDraft).toHaveBeenCalledExactlyOnceWith('Community support',expect.any(String));
 expect(api.call.mock.calls[0][0]).toBe('save_project_definition');
 expect(screen.queryByRole('button',{name:'Save details and load funding'})).toBeNull();
 expect(screen.queryByRole('option',{name:'FY 2028'})).toBeNull();
 expect(screen.getByLabelText('Office Budget source')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Fiscal year'),{target:{value:'2027'}});
 expect(screen.getByLabelText('No funding required for this project')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1000001'}});
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference'),{target:{value:'Approved programme'}});
 expect(authorize).toBeDisabled();
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234.56'}});
 expect(authorize).toBeEnabled();
 fireEvent.click(authorize);
 expect(await screen.findByText('Project funding authorized.')).toBeVisible();
 expect(api.call).toHaveBeenCalledWith('authorize_project_funding',{
  p_project:'p',p_lines:[{partitionId:'source',amount:1234.56}],p_reason:'Approved programme',p_key:expect.any(String),
 });
 expect(screen.getByRole('button',{name:/04.*Funding/})).toHaveAttribute('aria-current','step');
 expect(screen.getByLabelText('No funding required for this project')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(await screen.findByRole('heading',{name:'Ready to build the work plan?'})).toBeVisible();
});

it('retries an uncertain automatic Funding preparation with the same draft request',async()=>{
 const createDraft=vi.fn().mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce('p');
 const props={recoveryKey:'actor-office',profiles:[lead] as any,createDraft,onClose:vi.fn(),onFinish:vi.fn()};
 const values={title:'Community support',description:'Objectives',scope:'Training',lead:'lead',start:'2027-01-01',end:'2027-06-30',noFunding:false};
 localStorage.setItem(props.recoveryKey,JSON.stringify({values,step:3,projectId:''}));
 api.call.mockImplementation(async(_operation,{p_details:d})=>Object.assign(api.data.project,{
  description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end,
 }));
 render(<ProjectSetupWizard {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm project creation');
 expect(screen.queryByRole('region',{name:'Project budget'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry loading funding sources'}));
 await waitFor(()=>expect(screen.getByLabelText('Fiscal year')).toBeEnabled());
 expect(createDraft.mock.calls).toHaveLength(2);
 expect(createDraft.mock.calls[0]).toEqual(createDraft.mock.calls[1]);
 expect(screen.getByRole('button',{name:/04.*Funding/})).toHaveAttribute('aria-current','step');
});

it('recovers an uncertain wizard authorization and verifies its original funding terms',async()=>{
 Object.assign(api.data.project,{description:'Objectives',scope:'Training',project_lead_id:'lead',start_date:'2027-01-01',target_date:'2027-06-30'});
 const props={wizard:true,data:api.data,reload:api.reload,recoveryKey:'actor-office:funding:p'};
 api.call.mockResolvedValueOnce(null).mockResolvedValueOnce({authorized:1234});
 const first=render(<ProjectFundingPanel {...props}/>);
 fireEvent.change(screen.getByLabelText('Fiscal year'),{target:{value:'2027'}});
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234'}});
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference'),{target:{value:'Approved programme'}});
 fireEvent.click(screen.getByRole('button',{name:'Authorize project funding'}));
 await screen.findByRole('button',{name:'Verify saved funding request'});
 first.unmount();
 render(<ProjectFundingPanel {...props}/>);
 expect(screen.getByLabelText('Fiscal year')).toHaveValue('2027');
 expect(screen.getByLabelText('Fiscal year')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Verify saved funding request'}));
 expect(await screen.findByText('Project funding authorized.')).toBeVisible();
 expect(api.call.mock.calls[1]).toEqual(api.call.mock.calls[0]);
});

it('restores an unconfirmed funding request after reload and retries its original receipt',async()=>{
 const props={data:api.data,reload:api.reload,recoveryKey:'actor-office-funding'};
 api.call.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce('authorized');
 const first=render(<ProjectFundingPanel {...props}/>);
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234'}});
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference'),{target:{value:'Workshop'}});
 fireEvent.click(screen.getByRole('button',{name:'Authorize project funding'}));
 await screen.findByRole('button',{name:'Verify saved funding request'});
 first.unmount();
 render(<ProjectFundingPanel {...props}/>);
 expect(screen.getByRole('spinbutton')).toHaveValue('1,234');
 fireEvent.click(screen.getByRole('button',{name:'Verify saved funding request'}));
 await waitFor(()=>expect(api.call).toHaveBeenCalledTimes(2));
 expect(api.call.mock.calls[1]).toEqual(api.call.mock.calls[0]);
 await waitFor(()=>expect(localStorage.getItem(props.recoveryKey)).toBeNull());
});

it('keeps the Project Lead selected and restores the chosen Office members',async()=>{
 const lead={id:'lead',full_name:'Ari Lead',email:'ari@example.test',role:'member',is_active:true};
 const worker={id:'worker',full_name:'Toni Member',email:'toni@example.test',role:'member',is_active:true};
 const props={recoveryKey:'actor-office',profiles:[lead,worker] as any,createDraft:vi.fn(),onClose:vi.fn(),onFinish:vi.fn()};
 const values={title:'Community support',description:'Objectives',scope:'Workshop',lead:'lead',start:'2027-01-01',end:'2027-12-31',noFunding:true};
 localStorage.setItem(props.recoveryKey,JSON.stringify({values,step:4,projectId:'p',base:api.data.project}));
 const first=render(<ProjectSetupWizard {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 const leadBox=screen.getByRole('checkbox',{name:'Ari Lead · Project Lead'});
 expect(leadBox).toBeChecked();
 expect(leadBox).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Search Office members'),{target:{value:'Toni'}});
 fireEvent.click(screen.getByRole('checkbox',{name:'Toni Member'}));
 first.unmount();
 render(<ProjectSetupWizard {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 expect(screen.getByRole('checkbox',{name:'Toni Member'})).toBeChecked();
});

it('freezes an uncertain task allocation and verifies the original request without another deduction',async()=>{
 api.data={...initial(),ready:true,funds:[{id:'fund',fiscal_year:2027,quarter:1,name:'Community services',amount:300000,available:300000}],unallocated:300000};
 api.call.mockRejectedValueOnce(new Error('Network response lost')).mockRejectedValueOnce(new ProjectFlowError('Verification temporarily denied','42501')).mockResolvedValueOnce('allocation');const changed=vi.fn().mockResolvedValue(undefined);
 render(<TaskProjectFunding projectId="p" taskId="task" funded={false} onChanged={changed}/>);
 fireEvent.change(screen.getByLabelText('Task budget account 1'),{target:{value:'fund'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'20000'}});fireEvent.change(screen.getByLabelText('Allocation reason'),{target:{value:'Workshop materials'}});
 fireEvent.click(screen.getByRole('button',{name:'Allocate task budget'}));await screen.findByRole('button',{name:'Verify saved task allocation'});
 expect((screen.getByLabelText('Allocation reason') as HTMLTextAreaElement).closest('fieldset')?.disabled).toBe(true);
 const original=api.call.mock.calls[0];fireEvent.click(screen.getByRole('button',{name:'Verify saved task allocation'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Verification temporarily denied'));expect(api.call.mock.calls[1]).toEqual(original);fireEvent.click(screen.getByRole('button',{name:'Verify saved task allocation'}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());expect(api.call.mock.calls[2]).toEqual(original);
});
