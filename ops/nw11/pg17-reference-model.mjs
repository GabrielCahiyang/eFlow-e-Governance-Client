// Synthetic PG17-major metadata model. No hosted connection, private export or
// native restore claim. Its isolated dependency never changes the project lock.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {financialBaselineSql,financialMigration,migrationSource} from '../../tests/sql/helpers/financialCompatibilityDatabase.mjs';

const runtime=new URL('../../.refinement/nw11-constraint-20261016/pg17-runtime/node_modules/@electric-sql/pglite/',import.meta.url);
let modules;
async function load(){
 if(!modules){
  const pkg=JSON.parse(await fs.readFile(new URL('package.json',runtime),'utf8'));assert.equal(pkg.version,'0.4.6','Use the separately pinned reference runtime');
  const [core,tree,crypto]=await Promise.all([import(new URL('dist/index.js',runtime)),import(new URL('dist/contrib/ltree.js',runtime)),import(new URL('dist/contrib/pgcrypto.js',runtime))]);
  modules={PGlite:core.PGlite,ltree:tree.ltree,pgcrypto:crypto.pgcrypto};
 }
 return modules;
}
export async function pg17ReferenceDatabase({install=false}={}){
 const {PGlite,ltree,pgcrypto}=await load();const db=await PGlite.create({extensions:{ltree,pgcrypto}});
 try{
  const version=(await db.query("select current_setting('server_version_num')::int version,current_database() database")).rows[0];
  assert.equal(Math.floor(version.version/10000),17,'Do not generate hosted PG17 expectations with another major');assert.equal(version.database,'postgres');
  await db.exec(await financialBaselineSql());if(install)await db.exec(await migrationSource(financialMigration));return db;
 }catch(error){await db.close();throw error;}
}

// PG17 represents column NOT NULL via pg_attribute, not named pg_constraint
// rows. Inspect the real semantic flag plus precise types/defaults/identity.
export const columnAttributesQuery=`select coalesce(jsonb_agg(jsonb_build_object(
 'schema',n.nspname,'table',c.relname,'column',a.attname,
 'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
 'identity',a.attidentity::text,'generated',a.attgenerated::text,
 'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
 'collation_schema',cn.nspname,'collation_name',co.collname)
 order by n.nspname,c.relname,a.attnum),'[]'::jsonb)
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 left join pg_catalog.pg_collation co on co.oid=a.attcollation
 left join pg_catalog.pg_namespace cn on cn.oid=co.collnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in ('r','v','m')
 and (n.nspname='public' or n.nspname like 'eflow_%')`;
export const postMetadataQuery=core=>`select q.metadata||jsonb_build_object('column_attributes',(${columnAttributesQuery})) metadata from (${core}) q`;
