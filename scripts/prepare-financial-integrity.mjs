// Generate an additive operator package only. Never connects to a database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {financialIntegrityMigration,migrationSource} from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';

export async function financialIntegritySqlPackage(){
  const source=await migrationSource(financialIntegrityMigration);
  const version=financialIntegrityMigration.slice(0,14),name='financial_journal_and_refund_integrity';
  const marker='$eflow_integrity_source$';assert.ok(!source.includes(marker));
  const start=source.indexOf('begin;'),end=source.lastIndexOf('commit;');assert.ok(start>=0&&end>start);
  const sha256=createHash('sha256').update(source).digest('hex');
  const sql=`-- eFlow financial integrity follow-up; target ixnfphgjyelhckjwjkdv.
-- Run this WHOLE file once. Requires installed version 20261015125031.
-- Does NOT rerun or change that installed migration or any NW file.
-- Canonical migration SHA-256: ${sha256}
${source.slice(0,start+6)}
do $history_check$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'Supabase migration history is required';end if;
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261015125031') then
    raise exception 'Install financial compatibility 20261015125031 first';
  end if;
  if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then
    raise exception 'Financial integrity follow-up already installed; run verification instead';
  end if;
end $history_check$;
${source.slice(start+6,end)}
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${version}','${name}',array[${marker}${source}${marker}]);
commit;
select version,name,'Financial integrity follow-up installed' as result
from supabase_migrations.schema_migrations where version='${version}';
`;
  return {version,name,sha256,sqlEditorSha256:createHash('sha256').update(sql).digest('hex'),migration:financialIntegrityMigration,sql};
}
if(process.argv.includes('--json'))console.log(JSON.stringify(await financialIntegritySqlPackage()));
