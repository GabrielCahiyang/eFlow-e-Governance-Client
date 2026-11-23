// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({call:vi.fn(),read:vi.fn(),reload:vi.fn(),templates:vi.fn(),data:{} as any}));
vi.mock('../../src/app/features/project-setup/useProjectFlow',()=>({useProjectFlow:()=>({data:api.data,reload:api.reload,error:''})}));
vi.mock('../../src/app/features/project-setup/services/projectFlow',()=>({projectFlowCall:api.call,readProjectFlow:api.read,ProjectFlowError:class extends Error{}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'},userProfile:{id:'lead',role:'head'}})}));
vi.mock('../../src/app/shared/navigationGuard',()=>({useNavigationBlocker:vi.fn(),requestNavigation:async (action:()=>void)=>{action();return true;}}));
vi.mock('../../src/app/features/work-templates',()=>({
 listProjectTaskTemplates:api.templates,
 ProjectTaskTemplateLibrary:()=>null,
 summarizeProjectTaskTemplate:(groups:any[])=>({groupCount:groups.length,taskCount:0,subtaskCount:0,groupNames:[]}),
 saveProjectTaskTemplate:vi.fn(),
 parseProjectTaskGroups:(groups:any[])=>groups,
}));
import {ProjectSetupWizard} from '../../src/app/features/project-setup/components/ProjectSetupWizard';
import {ProjectDefinitionPanel} from '../../src/app/features/project-setup/components/ProjectDefinitionPanel';
import {ProjectFlowError} from '../../src/app/features/project-setup/services/projectFlow';
import {TaskProjectFunding} from '../../src/app/features/project-setup/components/TaskProjectFunding';
import {ProjectFundingPanel} from '../../src/app/features/project-setup/components/ProjectFundingPanel';
import {ProjectTaskDraftStep} from '../../src/app/features/project-setup/components/ProjectTaskDraftStep';
import {getPhilippineCalendarDate} from '../../src/app/shared/calendarDates';
import {formatManilaDate} from '../../src/app/shared/calendarDisplay';
const currentYear=Number(getPhilippineCalendarDate().slice(0,4));
const today=getPhilippineCalendarDate();
const todayUs=formatManilaDate(today);
const yesterday=getPhilippineCalendarDate(new Date(Date.now()-86400000));
const tomorrow=getPhilippineCalendarDate(new Date(Date.now()+86400000));
const initial=()=>({project:{id:'p',title:'Community support',description:'',scope:'',project_lead_id:null,start_date:null,target_date:null,funding_not_required:false,updated_at:'2026-10-30T00:00:00Z'},ready:false,canDraftWork:false,hasEligibleAccountingStaff:true,canAuthorize:true,canAllocate:true,funds:[],sources:[{id:'source',name:'Community services',year:currentYear,available:1000000}],requests:[],fundingRequests:[],taskFunding:[],liquidations:[],total:0,allocated:0,unallocated:0,released:0,spent:0});
const lead={id:'lead',full_name:'Ari Lead',email:'ari@example.test',role:'member' as const,is_active:true};
vi.setConfig({testTimeout:40000});
beforeEach(()=>{
 localStorage.clear();
 vi.resetAllMocks();
 api.data=initial();
 api.templates.mockResolvedValue([]);
 api.reload.mockResolvedValue(undefined);
 api.read.mockImplementation(async()=>api.data);
 api.call.mockImplementation(async(operation:string)=>{
  if(operation==='office_funding_sources_preview'){
   return {orgId:'org-1',canAuthorize:api.data.canAuthorize,hasEligibleAccountingStaff:api.data.hasEligibleAccountingStaff,sources:api.data.sources};
  }
 });
});
afterEach(cleanup);

it('keeps setup in a centered wizard, validates one section and retains entries',async()=>{
 render(<ProjectDefinitionPanel projectId="p" profiles={[]}/>);expect(screen.queryByLabelText('Description *')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Continue project setup'}));
 await screen.findByLabelText('Description *');fireEvent.click(screen.getByRole('button',{name:'Next'}));expect((await screen.findByRole('alert')).className).toBe('pf-error');fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'Keep this draft'}});fireEvent.click(screen.getByRole('button',{name:'Next'}));await screen.findByLabelText('Scope of the project *');expect(screen.queryByLabelText('Description *')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Back'}));expect((screen.getByLabelText('Description *') as HTMLTextAreaElement).value).toBe('Keep this draft');
});

it('renders inline funding management in funding section mode for the Budget tab without opening the wizard',()=>{
 render(<ProjectDefinitionPanel projectId="p" profiles={[]} section="funding"/>);
 expect(screen.queryByRole('region',{name:'Project definition'})).toBeNull();
 expect(screen.getByRole('region',{name:'Project budget'})).toBeInTheDocument();
 expect(screen.getByRole('checkbox',{name:'No funding required for this project'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Submit for Accounting certification'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Manage project funding'})).toBeNull();
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
 expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't confirm whether the project was created");
 view.unmount();
 render(<ProjectSetupWizard {...props}/>);
 expect(screen.getByRole('button',{name:'Start new project'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 fireEvent.click(screen.getByRole('button',{name:'Save draft and close'}));
 await waitFor(()=>expect(props.createDraft).toHaveBeenCalledTimes(2));
 expect(props.createDraft.mock.calls[1]).toEqual(props.createDraft.mock.calls[0]);
});

it('derives the funding total from source amounts without quarter selection and confirms before submitting',async()=>{
 api.data.sources.push({id:'source2',name:'Other services',year:currentYear,available:1000000});
 api.call.mockResolvedValue({authorized:0,requested:700000,status:'pending_accounting'});
 render(<ProjectFundingPanel data={api.data} reload={api.reload}/>);
 expect(screen.getByRole('button',{name:'Submit for Accounting certification'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'300000'}});
 fireEvent.click(screen.getByRole('button',{name:'Add funding source'}));
 fireEvent.change(screen.getAllByLabelText('Office Budget source')[1],{target:{value:'source2'}});
 expect(screen.queryByLabelText('Quarter')).toBeNull();
 fireEvent.change(screen.getAllByRole('spinbutton')[1],{target:{value:'400000'}});
 expect(screen.getByText(/Additional funding total:/).textContent).toContain('700,000');
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference *'),{target:{value:'Approved annual work program'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit for Accounting certification'}));
 fireEvent.click(await screen.findByRole('button',{name:'Confirm & submit'}));
 await waitFor(()=>expect(api.call).toHaveBeenCalledWith('authorize_project_funding',expect.objectContaining({p_lines:[{partitionId:'source',amount:300000},{partitionId:'source2',amount:400000}]})));
});

it('project lead requests authorization rather than reserving Office Budget directly',async()=>{
 api.call.mockResolvedValue('request');
 render(<ProjectFundingPanel data={{...api.data,canAuthorize:false}} reload={api.reload}/>);
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1000'}});
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference *'),{target:{value:'Additional workshop'}});
 fireEvent.click(screen.getByRole('button',{name:'Request funding'}));
 fireEvent.click(await screen.findByRole('button',{name:'Confirm & request funding'}));
 await waitFor(()=>expect(api.call.mock.calls[0][0]).toBe('request_project_funding'));
});

it('requires a reason in the funding release dialog and retains its request identity',async()=>{
 api.data.funds=[{id:'fund',name:'Community services',fiscal_year:currentYear,amount:500,available:500}];
 api.call.mockRejectedValueOnce(new Error('Result unavailable')).mockResolvedValueOnce('released');
 render(<ProjectFundingPanel data={api.data} reload={api.reload}/>);
 fireEvent.click(screen.getByRole('button',{name:'Return to Office Budget'}));
 const confirm=screen.getAllByRole('button',{name:'Return to Office Budget'}).at(-1)!;
 expect(confirm).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Reason (required)'),{target:{value:'Close out unspent funding'}});
 fireEvent.click(confirm);
 await screen.findByText('Result unavailable');
 fireEvent.click(confirm);
 await waitFor(()=>expect(api.call).toHaveBeenCalledTimes(2));
 expect(api.call.mock.calls[0]).toEqual(api.call.mock.calls[1]);
});

it('allows skipping freely across all 7 tabs in standard Create a project including Add people and Draft tasks while gating final submission',async()=>{
 render(<ProjectSetupWizard recoveryKey="actor-office" createDraft={vi.fn()} profiles={[]} onClose={vi.fn()} onFinish={vi.fn()}/>);
 await screen.findByLabelText('Description *');
 expect(screen.getByRole('button',{name:/02.*Scope/})).toBeEnabled();
 expect(screen.getByRole('button',{name:/05.*Review/})).toBeEnabled();
 expect(screen.getByRole('button',{name:/06.*Add people/})).toBeEnabled();
 expect(screen.getByRole('button',{name:/07.*Draft tasks/})).toBeEnabled();

 // Skip straight from Step 01 to Step 07 Draft tasks
 fireEvent.click(screen.getByRole('button',{name:/07.*Draft tasks/}));
 expect(screen.getByText('Finish earlier setup tabs before creating the project')).toBeVisible();
 expect(screen.getByRole('button',{name:'Open project'})).toBeDisabled();

 // Skip to optional Step 06 Add people too — interactive immediately without blocking gate
 fireEvent.click(screen.getByRole('button',{name:/06.*Add people/}));
 expect(screen.queryByText(/Complete earlier tabs to add your project team/i)).toBeNull();
 expect(screen.getByLabelText('Search Office members')).toBeVisible();

 // Jump back to Step 01 Details, then skip to Review and validate
 fireEvent.click(screen.getByRole('button',{name:/01.*Details/}));
 expect(screen.getByLabelText('Description *')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:/05.*Review/}));
 expect(screen.getByText('Ready to build the work plan?')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Next: Add people'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('title and description'));
 expect(api.call).not.toHaveBeenCalled();
});

it('keeps unsaved funding rows while jumping between tabs',async()=>{
 api.data.project={...api.data.project,description:'Deliver support',scope:'Workshop materials',project_lead_id:'lead',start_date:today,target_date:tomorrow};
 localStorage.setItem('actor-office',JSON.stringify({projectId:'p',step:2,creationPending:false,base:api.data.project,values:{title:api.data.project.title,description:api.data.project.description,scope:api.data.project.scope,lead:'lead',start:today,end:tomorrow,noFunding:false}}));
 render(<ProjectSetupWizard recoveryKey="actor-office" createDraft={vi.fn()} profiles={[lead] as any} onClose={vi.fn()} onFinish={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234'}});
 fireEvent.click(screen.getByRole('button',{name:/02.*Scope/}));
 fireEvent.click(screen.getByRole('button',{name:/04.*Funding/}));
 expect(screen.getByRole('spinbutton')).toHaveValue('1,234');
 expect(screen.getByLabelText('Office Budget source')).toHaveValue('source');
 expect(screen.getByRole('button',{name:'Next'})).toBeDisabled();
 expect(api.call).not.toHaveBeenCalled();
});

it('previews FY funding without creating a ghost project, submits for Accounting certification, and proceeds to Review under Option A',async()=>{
 const createDraft=vi.fn().mockResolvedValue('p');
 api.data.sources.push({id:'outside-year',name:'Future budget',year:currentYear+1,available:1000000});
 api.call.mockImplementation(async(operation,args)=>{
  if(operation==='office_funding_sources_preview'){
   return {orgId:'org-1',canAuthorize:true,hasEligibleAccountingStaff:true,sources:api.data.sources};
  }
  if(operation==='save_project_definition'){
   const d=args.p_details;
   Object.assign(api.data.project,{title:d.title,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end});
   return api.data.project;
  }
  if(operation==='authorize_project_funding'){
   api.data.fundingRequests=[{id:'req-1',actor_id:'lead',actorName:'Ari Lead',reason:args.p_reason,status:'pending_accounting',totalAmount:1234.56,lines:args.p_lines,canCancel:true,created_at:'2026-11-22T01:00:00Z'}];
   return {authorized:0,requested:1234.56,status:'pending_accounting'};
  }
 });
 render(<ProjectSetupWizard recoveryKey="actor-office" creatorId="lead" createDraft={createDraft} profiles={[lead] as any} onClose={vi.fn()} onFinish={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Project title *'),{target:{value:'Community support'}});
 fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'Deliver support'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 fireEvent.change(screen.getByLabelText('Scope of the project *'),{target:{value:'Training'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(screen.getByRole('button',{name:/03.*Dates/})).toHaveAttribute('aria-current','step');
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(screen.getByRole('alert')).toHaveTextContent('Enter a project start date');
 const start=screen.getByLabelText('Project start date *');
 const target=screen.getByLabelText('Project target date *');
 expect(start).toHaveAttribute('min',today);
 fireEvent.change(start,{target:{value:yesterday}});
 fireEvent.change(target,{target:{value:tomorrow}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(screen.getByRole('alert')).toHaveTextContent(`Project start date cannot be before ${todayUs}`);
 fireEvent.click(screen.getByRole('button',{name:'Save draft and close'}));
 expect(await screen.findByRole('alert')).toHaveTextContent(`Project start date cannot be before ${todayUs}`);
 expect(createDraft).not.toHaveBeenCalled();
 fireEvent.change(start,{target:{value:today}});
 fireEvent.change(target,{target:{value:yesterday}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(screen.getByRole('alert')).toHaveTextContent('on or after it');
 expect(createDraft).not.toHaveBeenCalled();
 fireEvent.change(target,{target:{value:tomorrow}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));

 // Entering Step 04 loads preview sources without creating a ghost project in DB.
 const submitBtn=await screen.findByRole('button',{name:'Submit for Accounting certification'});
 expect(screen.queryByLabelText('Fiscal year')).toBeNull();
 await waitFor(()=>expect(screen.getByLabelText('Office Budget source')).toBeEnabled());
 expect(createDraft).not.toHaveBeenCalled();
 expect(screen.queryByRole('option',{name:/Future budget/})).toBeNull();

 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 expect(screen.getByLabelText('No funding required for this project')).toBeDisabled();
 expect(screen.getByRole('button',{name:'Next'})).toBeDisabled();
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1000001'}});
 expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-invalid','true');
 expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available Office Budget');
 expect(screen.getByRole('button',{name:'Next'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference *'),{target:{value:'Approved programme'}});
 expect(submitBtn).toBeDisabled();
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234.56'}});
 expect(submitBtn).toBeEnabled();
 fireEvent.click(submitBtn);
 fireEvent.click(await screen.findByRole('button',{name:'Confirm & submit'}));

 expect(await screen.findByText('Submitted to Accounting Staff for independent funding certification.')).toBeVisible();
 expect(createDraft).toHaveBeenCalledExactlyOnceWith('Community support',expect.any(String));
 expect(api.call).toHaveBeenCalledWith('authorize_project_funding',{
  p_project:'p',p_lines:[{partitionId:'source',amount:1234.56}],p_reason:'Approved programme',p_key:expect.any(String),
 });
 expect(screen.getByRole('button',{name:/04.*Funding/})).toHaveAttribute('aria-current','step');
 expect(screen.getByLabelText('No funding required for this project')).toBeDisabled();
 expect(screen.getByRole('button',{name:'Next'})).toBeEnabled();

 // Option A: Advance immediately from Step 04 to Step 05 Review while Accounting certification is pending.
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(await screen.findByRole('heading',{name:'Ready to build the work plan?'})).toBeVisible();
 expect(screen.getByText(/Funding certification pending/)).toBeVisible();
 expect(screen.getByText(`${todayUs} → ${formatManilaDate(tomorrow)}`)).toBeVisible();
});

it('recovers an uncertain wizard funding submission and verifies its original funding terms',async()=>{
 Object.assign(api.data.project,{description:'Objectives',scope:'Training',project_lead_id:'lead',start_date:'',target_date:''});
 const props={wizard:true,data:api.data,reload:api.reload,recoveryKey:'actor-office:funding:p'};
 api.call.mockResolvedValueOnce(null).mockResolvedValueOnce({authorized:0,requested:1234,status:'pending_accounting'});
 const first=render(<ProjectFundingPanel {...props}/>);
 expect(screen.queryByLabelText('Fiscal year')).toBeNull();
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234'}});
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference *'),{target:{value:'Approved programme'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit for Accounting certification'}));
 fireEvent.click(await screen.findByRole('button',{name:'Confirm & submit'}));
 await screen.findByRole('button',{name:'Verify saved funding request'});
 first.unmount();
 render(<ProjectFundingPanel {...props}/>);
 expect(screen.getByLabelText('Office Budget source')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Verify saved funding request'}));
 expect(await screen.findByText('Submitted to Accounting Staff for independent funding certification.')).toBeVisible();
 expect(api.call.mock.calls[1]).toEqual(api.call.mock.calls[0]);
});

it('restores an unconfirmed funding request after reload and retries its original receipt',async()=>{
 const props={data:api.data,reload:api.reload,recoveryKey:'actor-office-funding'};
 api.call.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({authorized:0,requested:1234,status:'pending_accounting'});
 const first=render(<ProjectFundingPanel {...props}/>);
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1234'}});
 fireEvent.change(screen.getByLabelText('Reason / approved authority reference *'),{target:{value:'Workshop'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit for Accounting certification'}));
 fireEvent.click(await screen.findByRole('button',{name:'Confirm & submit'}));
 await screen.findByRole('button',{name:'Verify saved funding request'});
 first.unmount();
 render(<ProjectFundingPanel {...props}/>);
 expect(screen.getByRole('spinbutton')).toHaveValue('1,234');
 fireEvent.click(screen.getByRole('button',{name:'Verify saved funding request'}));
 await waitFor(()=>expect(api.call).toHaveBeenCalledTimes(2));
 expect(api.call.mock.calls[1]).toEqual(api.call.mock.calls[0]);
 await waitFor(()=>expect(localStorage.getItem(props.recoveryKey)).toBeNull());
});

it('includes Add people in standard Create project wizard between Review and Draft tasks',async()=>{
 const leadProfile={id:'lead',full_name:'Ari Lead',email:'ari@example.test',role:'member',is_active:true};
 const worker={id:'worker',full_name:'Toni Member',email:'toni@example.test',role:'member',is_active:true};
 const props={recoveryKey:'actor-office',profiles:[leadProfile,worker] as any,createDraft:vi.fn(),onClose:vi.fn(),onFinish:vi.fn()};
 const values={title:'Community support',description:'Objectives',scope:'Workshop',lead:'lead',start:today,end:tomorrow,noFunding:true};
 localStorage.setItem(props.recoveryKey,JSON.stringify({values,step:3,projectId:'p',base:api.data.project}));
 render(<ProjectSetupWizard {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue draft'}));
 expect(screen.getByText('Ready to build the work plan?')).toBeTruthy();
 expect(screen.getByRole('button',{name:/06.*Add people/i})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:/07.*Draft tasks/})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Next: Add people'})).toBeInTheDocument();
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

it('edits project settings inline when setup is already ready without opening the wizard',async()=>{
 const readyProject={...initial().project,status:'planning',description:'Original description',scope:'Original scope',project_lead_id:'lead',start_date:'2027-01-01',target_date:'2027-02-01'};
 api.data={...initial(),project:readyProject,ready:true};
 api.call.mockResolvedValueOnce({...readyProject,title:'Updated title',updated_at:'2026-10-31T00:00:00Z'});
 render(<ProjectDefinitionPanel projectId="p" profiles={[lead] as any} section="details"/>);
 expect(screen.queryByRole('button',{name:'Edit project details'})).toBeNull();
 expect(screen.queryByRole('region',{name:'Project budget'})).toBeNull();
 fireEvent.change(screen.getByLabelText('Project title *'),{target:{value:'Updated title'}});
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await screen.findByText('Project settings saved.');
 expect(api.call).toHaveBeenCalledWith('save_project_definition',{
  p_project:'p',
  p_details:expect.objectContaining({title:'Updated title',version:'2026-10-30T00:00:00Z'}),
 });
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps project settings and funding-requirement toggle read-only once the project is active',()=>{
 const activeProject={...initial().project,status:'active',description:'Active description',scope:'Active scope',project_lead_id:'lead',start_date:'2027-01-01',target_date:'2027-02-01'};
 api.data={...initial(),project:activeProject,ready:true};
 const settingsView=render(<ProjectDefinitionPanel projectId="p" profiles={[lead] as any} section="details"/>);
 expect(screen.getByText('Project settings are read-only once planning ends.')).toBeInTheDocument();
 expect(screen.getByText('Editing is disabled')).toBeInTheDocument();
 expect(screen.getByText(/Editing is locked because this project is active/)).toBeInTheDocument();
 const titleInput=screen.getByLabelText('Project title *') as HTMLInputElement;
 const scopeTextarea=screen.getByLabelText('Scope of the project *') as HTMLTextAreaElement;
 expect(titleInput.closest('fieldset')?.disabled).toBe(true);
 expect(titleInput.closest('fieldset')?.getAttribute('data-readonly')).toBe('true');
 expect(scopeTextarea.readOnly).toBe(true);
 expect(screen.queryByRole('button',{name:'Save changes'})).toBeNull();
 settingsView.unmount();
 render(<ProjectDefinitionPanel projectId="p" profiles={[lead] as any} section="funding"/>);
 expect(screen.queryByRole('checkbox',{name:'No funding required for this project'})).toBeNull();
});

it('allows removing individual groups, tasks, and subtasks with X buttons and 1-click Undo in Draft tasks',()=>{
 render(<ProjectTaskDraftStep
  projectId="p"
  project={{title:'Outreach'}}
  templates={[]}
  templateError=""
  initialTemplate={{
   id:'tpl-1',
   name:'Outreach',
   description:'Template',
   org_id:'o',
   created_by:'lead',
   is_archived:false,
   created_at:'',
   updated_at:'',
   groups:[
    {title:'Planning',color:'#087972',tasks:[
     {title:'Prepare materials',description:'',priority:'medium',subtasks:['Print flyers','Confirm venue']},
     {title:'Coordinate leads',description:'',priority:'high',subtasks:[]},
    ]},
    {title:'Delivery',color:'#579bfc',tasks:[
     {title:'Conduct orientation',description:'',priority:'medium',subtasks:[]},
    ]},
   ],
  }}
  onSaved={vi.fn()}
  onBusyChange={vi.fn()}
 />);
 expect(screen.queryByRole('button',{name:'Generate with AI',exact:true})).toBeNull();
 expect(screen.getByRole('combobox',{name:'Use a template'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Remove subtask Print flyers'}));
 expect(screen.queryByDisplayValue('Print flyers')).toBeNull();
 expect(screen.getByDisplayValue('Confirm venue')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Remove task Coordinate leads'}));
 expect(screen.queryByDisplayValue('Coordinate leads')).toBeNull();
 expect(screen.getByDisplayValue('Prepare materials')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Remove group Delivery'}));
 expect(screen.queryByDisplayValue('Delivery')).toBeNull();
 expect(screen.getByDisplayValue('Planning')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Undo'}));
 expect(screen.getByDisplayValue('Delivery')).toBeInTheDocument();
});

it('omits Add people in Create project with AI and advances sequentially to Dates and Import AI PDF',async()=>{
 const createDraft=vi.fn().mockResolvedValue('p');
 api.call.mockImplementation(async(operation,args)=>{
  if(operation==='save_project_definition'){
   const d=args.p_details;
   Object.assign(api.data.project,{title:d.title,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end,funding_not_required:d.noFunding});
   return api.data.project;
  }
 });
 render(<ProjectSetupWizard importPdf recoveryKey="actor-office" creatorId="lead" createDraft={createDraft} profiles={[lead] as any} onClose={vi.fn()} onFinish={vi.fn()}/>);
 expect(screen.queryByRole('button',{name:/Add people/})).toBeNull();
 expect(screen.getByRole('button',{name:/06.*Import AI PDF/})).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Project title *'),{target:{value:'AI Project'}});
 fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'AI project overview'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 fireEvent.change(screen.getByLabelText('Scope of the project *'),{target:{value:'AI proposal scope'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(screen.getByLabelText('Project start date *')).toBeVisible();
 expect(screen.getByLabelText('Project target date *')).toBeVisible();
});
