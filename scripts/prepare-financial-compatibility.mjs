// Generate reviewable operator SQL; never connects to Supabase or applies SQL.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {financialMigration,migrationSource} from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
export async function financialSqlPackage(){
  const source=await migrationSource(financialMigration);
  const version=financialMigration.slice(0,14),name='financial_cash_compatibility';
  const sha256=createHash('sha256').update(source).digest('hex');
  const marker='$eflow_financial_source$';assert.ok(!source.includes(marker));
  const beginning=source.indexOf('begin;'),ending=source.lastIndexOf('commit;');
  assert.ok(beginning>=0&&ending>beginning);
  const preflight=`
-- SQL Editor installation: exact NEW history entry, in the same transaction.
do $preflight$
declare required_version text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'Supabase migration history is required';end if;
  if exists(select 1 from supabase_migrations.schema_migrations h where h.version='${version}') then raise exception 'Financial package already installed; run verification instead';end if;
  foreach required_version in array array['20261003000004','20261004123126','20261004132527','20261004133412','20261004140128','20261004164937','20261004181549','20261004182806','20261004194130','20261005170822','20261007120000','20261007152648','20261007153615','20261007175525','20261007191654','20261007195837','20261007201249','20261007203525','20261008004900','20261008030659','20261008035748','20261008060756','20261008081855','20261008123723','20261008134347','20261009120000','20261009120100'] loop
    if not exists(select 1 from supabase_migrations.schema_migrations h where h.version=required_version) then raise exception 'Reviewed hosted baseline version missing: %',required_version;end if;
  end loop;
end $preflight$;
`;
  const receipt=`
-- Record only this new version. Do not claim the old financial file ran.
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${version}','${name}',array[${marker}${source}${marker}]);
commit;
select version,name,'Financial compatibility installed' as result from supabase_migrations.schema_migrations where version='${version}';
`;
  const sql=`-- eFlow financial compatibility; target ixnfphgjyelhckjwjkdv.
-- Prepared for the user to run in Supabase SQL Editor. No deployment performed.
-- Migration SHA-256: ${sha256}
-- Run this WHOLE file once, BEFORE the nine NW correction migrations.
${source.slice(0,beginning+6)}${preflight}${source.slice(beginning+6,ending)}${receipt}`;
  return {version,name,sha256,sqlEditorSha256:createHash('sha256').update(sql).digest('hex'),migration:financialMigration,sql};
}
if(process.argv.includes('--json'))console.log(JSON.stringify(await financialSqlPackage()));
