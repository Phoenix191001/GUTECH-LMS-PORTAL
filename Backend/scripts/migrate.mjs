// Applies supabase/migrations/*.sql in order using DATABASE_URL.
// Each file runs in its own transaction and is recorded, so re-running is safe.
// Usage: npm run migrate
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url || url.includes('YOUR-DB-PASSWORD')) {
  console.error('Set DATABASE_URL in Backend/.env first.')
  process.exit(1)
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query('create schema if not exists lms_meta')
  await client.query('create table if not exists lms_meta.applied_migrations (name text primary key, applied_at timestamptz not null default now())')
  const done = new Set((await client.query('select name from lms_meta.applied_migrations')).rows.map((r) => r.name))

  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip   ${file} (already applied)`)
      continue
    }
    const sql = await readFile(path.join(dir, file), 'utf8')
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into lms_meta.applied_migrations (name) values ($1)', [file])
      await client.query('commit')
      console.log(`apply  ${file}`)
    } catch (e) {
      await client.query('rollback')
      console.error(`FAILED ${file}: ${e.message}`)
      process.exitCode = 1
      break
    }
  }
} finally {
  await client.end()
}
