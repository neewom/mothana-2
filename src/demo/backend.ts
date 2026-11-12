// Spike démo PGlite (carte O6ZIN4DZ) — code de preuve de concept, non destiné au merge.
// Monte un « Supabase » complet dans le navigateur : Postgres (PGlite/WASM) + couche
// PostgREST/GoTrue/Storage (tinbase), servi in-process à supabase-js via un fetch intercepté.
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { citext } from '@electric-sql/pglite/contrib/citext'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { createBackend, type BackendConfig, type TinbaseBackend } from 'tinbase'
import schemaSql from './schema.sql?raw'
import { seedDemo, DEMO_ADMIN, DEMO_PIN } from './seed'
import { demoFunctions } from './functionStubs'
import { fastIntrospection } from './introspection'

export const DEMO_DB_NAME = 'samakan-demo'
const SCHEMA_VERSION = '2026-11-13'

type DbEngine = NonNullable<BackendConfig['engine']>
type Queryable = Pick<PGlite, 'query' | 'exec'>

function wrap(q: Queryable) {
  return {
    async query(sql: string, params?: unknown[]) {
      const r = await q.query(fastIntrospection(sql), params)
      return { rows: r.rows as Record<string, unknown>[], affectedRows: r.affectedRows }
    },
    async exec(sql: string) {
      await q.exec(sql)
    },
  }
}

// Même moteur que celui de tinbase, avec en plus l'extension unaccent (utilisée par la recherche).
async function makeEngine(dataDir: string | undefined): Promise<{ engine: DbEngine; pg: PGlite }> {
  const pg = new PGlite({ dataDir, extensions: { uuid_ossp, pgcrypto, citext, pg_trgm, unaccent } })
  await pg.waitReady
  const engine = {
    ...wrap(pg),
    async execMany(sql: string) {
      const rs = await pg.exec(sql)
      return rs.map((r) => ({ rows: r.rows as Record<string, unknown>[], affectedRows: r.affectedRows }))
    },
    transaction<T>(fn: (tx: ReturnType<typeof wrap>) => Promise<T>) {
      return pg.transaction((tx) => fn(wrap(tx)))
    },
    listen: (channel: string, cb: (payload: string) => void) => pg.listen(channel, cb),
    close: () => pg.close(),
  } as unknown as DbEngine
  return { engine, pg }
}

export interface DemoBackend {
  backend: TinbaseBackend
  pg: PGlite
  timings: Record<string, number>
  firstBoot: boolean
}

export async function startDemoBackend(opts: { persist?: boolean } = {}): Promise<DemoBackend> {
  const timings: Record<string, number> = {}
  const t0 = performance.now()
  const { engine, pg } = await makeEngine(opts.persist === false ? undefined : `idb://${DEMO_DB_NAME}`)
  timings.pglite = performance.now() - t0

  const backend = await createBackend({
    engine,
    functions: demoFunctions(),
    siteUrl: location.origin,
  })
  timings.tinbase = performance.now() - t0

  await pg.exec('create table if not exists public._demo_meta (cle text primary key, valeur text)')
  const { rows } = await pg.query<{ valeur: string }>("select valeur from public._demo_meta where cle = 'schema'")
  const firstBoot = rows[0]?.valeur !== SCHEMA_VERSION
  if (firstBoot) {
    await pg.exec(schemaSql)
    timings.schema = performance.now() - t0
    await seedDemo(backend, pg)
    await pg.query("insert into public._demo_meta values ('schema', $1) on conflict (cle) do update set valeur = excluded.valeur", [SCHEMA_VERSION])
    timings.seed = performance.now() - t0
  }
  timings.total = performance.now() - t0
  return { backend, pg, timings, firstBoot }
}

export async function resetDemo(): Promise<void> {
  // PGlite stocke la base dans IndexedDB sous le nom /pglite/<dataDir>.
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(`/pglite/${DEMO_DB_NAME}`)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
  for (const k of Object.keys(localStorage)) if (k.startsWith('sb-demo')) localStorage.removeItem(k)
  sessionStorage.clear()
}

export { DEMO_ADMIN, DEMO_PIN }
