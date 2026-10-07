import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString) {
  console.log('Migraciones omitidas: no hay conexión PostgreSQL en este entorno.');
  process.exit(0);
}

const version = '202610070001';
const migrationPath = path.resolve('supabase/migrations/202610070001_initial_schema.sql');
const migration = await fs.readFile(migrationPath, 'utf8');
const sql = postgres(connectionString, { max:1, ssl:'require', prepare:false });

try {
  await sql`create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())`;
  const applied = await sql`select version from public.schema_migrations where version = ${version}`;
  if (applied.length) {
    console.log(`Migración ${version} ya aplicada.`);
  } else {
    await sql.begin(async transaction => {
      await transaction.unsafe(migration);
      await transaction`insert into public.schema_migrations (version) values (${version})`;
    });
    console.log(`Migración ${version} aplicada correctamente.`);
  }
} finally {
  await sql.end();
}
