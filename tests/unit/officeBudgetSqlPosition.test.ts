import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('reads empty and populated budget sections without ambiguous positions, preserving JSON order', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create schema eflow_budget;
      create table public.office_budget_sections(id uuid primary key, position integer, journal_account_code text);
      create function eflow_budget.pre_financial_get_sections(uuid,integer) returns jsonb language sql stable as
      $$select current_setting('test.budget_sections')::jsonb$$;
      set test.budget_sections='{"version":0,"sections":[]}';`);
    const directory = new URL('../../supabase/migrations/', import.meta.url);
    const file = (await readdir(directory)).find(name => name.endsWith('_qualify_office_budget_section_position.sql'));
    expect(file).toBeTruthy();
    const fix = await readFile(new URL(file!, directory), 'utf8');
    // Reproduce the deployed failure on the same table/ordinality name collision.
    await db.exec(fix.replace('order by sections.position)', 'order by position)'));
    await expect(db.query("select eflow_budget.get_sections(null,2026)")).rejects.toThrow(/position.*ambiguous/);
    await db.exec(fix);
    const read = async () => (await db.query<{value: {version:number;sections:Record<string,unknown>[];itemizedCashAvailable:boolean}}>('select eflow_budget.get_sections(null,2026) as value')).rows[0].value;
    expect(await read()).toEqual({version:0,sections:[],itemizedCashAvailable:true});
    const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002',unmapped='00000000-0000-4000-8000-000000000003';
    await db.query('insert into office_budget_sections values ($1,99,$2),($3,0,$4)',[first,'EXP-A',second,'EXP-B']);
    await db.query("select set_config('test.budget_sections',$1,false)",[JSON.stringify({version:7,sections:[{id:first,position:3},{id:second,position:1},{id:unmapped,position:2}]})]);
    const result=await read();
    expect(result.version).toBe(7);
    expect(result.sections).toEqual([{id:first,position:3,journalAccountCode:'EXP-A'},{id:second,position:1,journalAccountCode:'EXP-B'},{id:unmapped,position:2,journalAccountCode:null}]);
  } finally { await db.close(); }
},30000);
