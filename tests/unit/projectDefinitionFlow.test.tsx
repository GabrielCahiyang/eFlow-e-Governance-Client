// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({call:vi.fn(),read:vi.fn(),reload:vi.fn(),data:{} as any}));
vi.mock('../../src/app/features/project-setup/useProjectFlow',()=>({useProjectFlow:()=>({data:api.data,reload:api.reload,error:''})}));
vi.mock('../../src/app/features/project-setup/services/projectFlow',()=>({projectFlowCall:api.call,readProjectFlow:api.read,ProjectFlowError:class extends Error{}}));
vi.mock('../../src/app/shared/navigationGuard',()=>({useNavigationBlocker:vi.fn()}));
import {ProjectSetupWizard} from '../../src/app/features/project-setup/components/ProjectSetupWizard';
import {ProjectDefinitionPanel} from '../../src/app/features/project-setup/components/ProjectDefinitionPanel';
import {ProjectFlowError} from '../../src/app/features/project-setup/services/projectFlow';
import {TaskProjectFunding} from '../../src/app/features/project-setup/components/TaskProjectFunding';
import {ProjectFundingPanel} from '../../src/app/features/project-setup/components/ProjectFundingPanel';
const initial=()=>({project:{id:'p',title:'Community support',description:'',scope:'',project_lead_id:null,start_date:null,target_date:null,funding_not_required:false,updated_at:'2026-10-30T00:00:00Z'},ready:false,canAuthorize:true,canAllocate:true,funds:[],sources:[{id:'source',name:'Community services',year:2027,available:1000000}],requests:[],fundingRequests:[],taskFunding:[],liquidations:[],total:0,allocated:0,unallocated:0,released:0,spent:0});
vi.setConfig({testTimeout:15000});
beforeEach(()=>{vi.resetAllMocks();api.data=initial();api.reload.mockResolvedValue(undefined);api.read.mockImplementation(async()=>api.data);});afterEach(cleanup);
it('keeps setup in a centered wizard, validates one section and retains entries',async()=>{
 render(<ProjectDefinitionPanel projectId="p" profiles={[]}/>);expect(screen.queryByLabelText('Description *')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Continue project setup'}));
 await screen.findByLabelText('Description *');fireEvent.click(screen.getByRole('button',{name:'Next'}));expect((await screen.findByRole('alert')).className).toBe('pf-error');fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'Keep this draft'}});fireEvent.click(screen.getByRole('button',{name:'Next'}));await screen.findByLabelText('Scope of the project *');expect(screen.queryByLabelText('Description *')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Back'}));expect((screen.getByLabelText('Description *') as HTMLTextAreaElement).value).toBe('Keep this draft');
});
it('saves all sections and their metadata version before opening the funding step',async()=>{
 api.call.mockImplementation(async(name,args)=>{if(name==='save_project_definition'){const d=args.p_details;api.data.project={...api.data.project,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end,funding_not_required:d.noFunding,updated_at:'2026-10-30T01:00:00Z'};return api.data.project;}});
 render(<ProjectSetupWizard projectId="p" profiles={[{id:'lead',full_name:'Project Lead',role:'member',is_active:true} as any]} onClose={vi.fn()} onFinish={vi.fn()}/>);
 await screen.findByLabelText('Description *');fireEvent.change(screen.getByLabelText('Description *'),{target:{value:'Objectives'}});fireEvent.click(screen.getByRole('button',{name:'Next'}));await screen.findByLabelText('Scope of the project *');fireEvent.change(screen.getByLabelText('Scope of the project *'),{target:{value:'Workshop delivery'}});fireEvent.click(screen.getByRole('button',{name:'Next'}));await screen.findByLabelText('Project lead *');fireEvent.change(screen.getByLabelText('Project lead *'),{target:{value:'lead'}});fireEvent.change(screen.getByLabelText('Project start date *'),{target:{value:'2027-01-01'}});fireEvent.change(screen.getByLabelText('Project target date *'),{target:{value:'2027-06-30'}});
 expect((screen.getByLabelText('Project target date *') as HTMLInputElement).min).toBe('2027-01-01');fireEvent.click(screen.getByRole('button',{name:'Next'}));await screen.findByRole('region',{name:'Project funding step'});expect(api.call).toHaveBeenCalledWith('save_project_definition',expect.objectContaining({p_project:'p',p_details:expect.objectContaining({scope:'Workshop delivery',lead:'lead',version:'2026-10-30T00:00:00Z'})}));
});
it('derives the funding total from explicit source and quarter rows',async()=>{
 api.call.mockResolvedValue({authorized:700000});render(<ProjectFundingPanel data={api.data} reload={api.reload}/>);
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'300000'}});
 fireEvent.click(screen.getByRole('button',{name:'Add funding source'}));fireEvent.change(screen.getAllByLabelText('Office Budget source')[1],{target:{value:'source'}});fireEvent.change(screen.getAllByLabelText('Quarter')[1],{target:{value:'2'}});fireEvent.change(screen.getAllByRole('spinbutton')[1],{target:{value:'400000'}});
 expect(screen.getByText(/Additional funding total:/).textContent).toContain('700,000');fireEvent.change(screen.getByLabelText('Reason / approved authority reference'),{target:{value:'Approved annual work program'}});fireEvent.click(screen.getByRole('button',{name:'Authorize project funding'}));
 await waitFor(()=>expect(api.call).toHaveBeenCalledWith('authorize_project_funding',expect.objectContaining({p_lines:[{partitionId:'source',quarter:1,amount:300000},{partitionId:'source',quarter:2,amount:400000}]})));
});
it('project lead requests authorization rather than reserving Office Budget directly',async()=>{
 api.call.mockResolvedValue('request');render(<ProjectFundingPanel data={{...api.data,canAuthorize:false}} reload={api.reload}/>);
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'source'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1000'}});fireEvent.change(screen.getByLabelText('Reason / approved authority reference'),{target:{value:'Additional workshop'}});fireEvent.click(screen.getByRole('button',{name:'Request Head authorization'}));await waitFor(()=>expect(api.call.mock.calls[0][0]).toBe('request_project_funding'));
});

it('freezes an uncertain task allocation and verifies the original request without another deduction',async()=>{
 api.data={...initial(),ready:true,funds:[{id:'fund',fiscal_year:2027,quarter:1,name:'Community services',amount:300000,available:300000}],unallocated:300000};
 api.call.mockRejectedValueOnce(new Error('Network response lost')).mockRejectedValueOnce(new ProjectFlowError('Verification temporarily denied','42501')).mockResolvedValueOnce('allocation');const changed=vi.fn().mockResolvedValue(undefined);
 render(<TaskProjectFunding projectId="p" taskId="task" funded={false} onChanged={changed}/>);
 fireEvent.change(screen.getByLabelText('Project funding source'),{target:{value:'fund'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'20000'}});fireEvent.change(screen.getByLabelText('Allocation reason'),{target:{value:'Workshop materials'}});
 fireEvent.click(screen.getByRole('button',{name:'Allocate task budget'}));await screen.findByRole('button',{name:'Verify saved task allocation'});
 expect((screen.getByLabelText('Allocation reason') as HTMLTextAreaElement).closest('fieldset')?.disabled).toBe(true);
 const original=api.call.mock.calls[0];fireEvent.click(screen.getByRole('button',{name:'Verify saved task allocation'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Verification temporarily denied'));expect(api.call.mock.calls[1]).toEqual(original);fireEvent.click(screen.getByRole('button',{name:'Verify saved task allocation'}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());expect(api.call.mock.calls[2]).toEqual(original);
});
