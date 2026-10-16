import type { Page } from '@playwright/test';
import { projectWorkspaceFixture } from './projectWorkspace';

export async function globalUiP5aFixture(page: Page, role: 'admin'|'head'|'member'|'accounting_staff'='admin', theme:'light'|'dark'='light', empty=false, overrides:Record<string,boolean>={}) {
  const records=await projectWorkspaceFixture(page,role,false,{landingOnly:true,theme,overrides});
  const state={unavailable:false,writes:[] as string[]};
  if(!empty) records.profiles.push({...records.profile,id:'00000000-0000-4000-8000-000000000010',role:'member',full_name:'Maria Santos with a long distinguishing municipal planning and coordination name',email:'maria.planning.and.coordination@example.test'},{...records.profile,id:'00000000-0000-4000-8000-000000000011',role:'member',full_name:'Ari another authorized account',email:'ari@example.test'});
  const values={organization_name:'Municipal coordination office',app_version:'2.0'};
  await page.route('**/rest/v1/system_config*',route=>route.fulfill({json:new URL(route.request().url()).searchParams.get('key')?.startsWith('eq.')?{value:null}:Object.entries(values).map(([key,value])=>({key,value}))}));
  await page.route('**/rest/v1/audit_events*',route=>state.unavailable?route.fulfill({status:400,json:{message:'Synthetic audit read unavailable'}}):route.fulfill({json:[],headers:{'content-range':'*/0','access-control-expose-headers':'content-range'}}));
  await page.route(/\/controlpanelEflow\/api\/admin\/login-security(?:\/|$)/,route=>{
    if(route.request().method()!=='GET'){state.writes.push(route.request().url());return route.fulfill({status:403,json:{detail:'Read-only inspection fixture'}});}
    return route.fulfill({json:{max_attempts:3,accounts:empty?[]:[{user_id:'00000000-0000-4000-8000-000000000010',email:'maria.planning.and.coordination@example.test',full_name:'Maria Santos with a long distinguishing municipal planning and coordination name',role:'member',failed_attempts:3,locked_at:'2026-10-14T00:00:00Z',last_failed_at:'2026-10-14T00:00:00Z'}]}});
  });
  await page.route(/\/controlpanelEflow\/api\/admin\/configuration-health$/,route=>route.fulfill({status:503,json:{detail:'Synthetic provider health unavailable'}}));
  await page.route(/\/controlpanelEflow\/api\/admin\/backups$/,route=>state.unavailable?route.fulfill({status:503,json:{detail:'Synthetic backup gateway unavailable'}}):route.fulfill({json:{jobs:[],preflight:{configured:false,database_url_configured:false,pg_dump_available:false,encryption_available:false,retention_hours:24,tables:[],table_count:0,safe_excluded_data_tables:[]}}}));
  return {...records,state};
}
