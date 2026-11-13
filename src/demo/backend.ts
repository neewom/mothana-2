// Monte un « Supabase » complet dans le navigateur : Postgres (PGlite, WebAssembly) et la couche
// PostgREST / GoTrue / Storage de tinbase, servie à supabase-js par un fetch intercepté
// (fetchInterceptor.ts). La RLS réelle s'applique (rôle et claims JWT posés par tinbase).
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { createBackend, type BackendConfig, type TinbaseBackend } from 'tinbase'
import schemaSql from './schema.sql?raw'
import { seedDemo } from './seed'
export { DEMO_ADMIN } from './seed'
import { demoFunctions } from './functionStubs'
import { fastIntrospection } from './introspection'
import { DEMO_DB_NAME, deleteDemoDatabase } from './storage'
import type { EngineAssets } from './engineDownload'

// À changer à chaque nouvel instantané du schéma (schema.sql) ou du jeu de données (seed.ts) :
// une base enregistrée sous une autre version est effacée et recréée au démarrage suivant.
const DATA_VERSION = '2026-11-13e'

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

// Même moteur que celui de tinbase, réduit aux extensions utilisées par le schéma (pgcrypto et
// citext retirés : -1,1 Mo ; schema.sql fournit un équivalent de gen_random_bytes), plus unaccent
// (utilisée par la recherche).
// `engine` : fichiers du moteur déjà téléchargés par l'écran d'attente (engineDownload.ts) ; sans
// eux, PGlite les télécharge lui-même.
async function openDatabase(persist: boolean, engine?: EngineAssets): Promise<PGlite> {
  const pg = new PGlite({ dataDir: persist ? `idb://${DEMO_DB_NAME}` : undefined, extensions: { uuid_ossp, pg_trgm, unaccent }, ...engine })
  await pg.waitReady
  return pg
}

function toEngine(pg: PGlite): DbEngine {
  return {
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
}

async function storedVersion(pg: PGlite): Promise<string | undefined> {
  await pg.exec('create table if not exists public._demo_meta (cle text primary key, valeur text)')
  const { rows } = await pg.query<{ valeur: string }>("select valeur from public._demo_meta where cle = 'schema'")
  return rows[0]?.valeur
}

export interface DemoBackend {
  backend: TinbaseBackend
  pg: PGlite
  /** Vrai quand la base vient d'être créée (schéma et jeu de données chargés). */
  firstBoot: boolean
  /** Durées cumulées depuis le début du démarrage, en ms. */
  timings: Record<string, number>
}

/** Étapes signalées à l'écran d'attente : base ouverte, puis (premier démarrage) schéma et jeu de données. */
export type BackendStep = 'schema' | 'seed'

export interface StartDemoBackendOptions {
  /** `false` : tout reste en mémoire (rien dans IndexedDB), utile pour les tests automatisés. */
  persist?: boolean
  engine?: EngineAssets
  onStep?: (step: BackendStep) => void
}

/** Démarre la base de la démo. */
export async function startDemoBackend({ persist = true, engine, onStep }: StartDemoBackendOptions = {}): Promise<DemoBackend> {
  const timings: Record<string, number> = {}
  const t0 = performance.now()
  let pg = await openDatabase(persist, engine)
  let version = await storedVersion(pg)
  if (version !== undefined && version !== DATA_VERSION) {
    // Base d'une version précédente de la démo : on repart d'une base neuve.
    await pg.close()
    await deleteDemoDatabase()
    pg = await openDatabase(persist, engine)
    version = await storedVersion(pg)
  }
  timings.pglite = performance.now() - t0

  const backend = await createBackend({ engine: toEngine(pg), functions: demoFunctions(), siteUrl: location.origin })
  timings.tinbase = performance.now() - t0

  const firstBoot = version === undefined
  if (firstBoot) {
    try {
      onStep?.('schema')
      await pg.exec(schemaSql)
      timings.schema = performance.now() - t0
      onStep?.('seed')
      await seedDemo(backend, pg)
      await pg.query("insert into public._demo_meta values ('schema', $1)", [DATA_VERSION])
      timings.seed = performance.now() - t0
    } catch (err) {
      // Une base à moitié créée bloquerait tous les démarrages suivants : on l'efface.
      await pg.close().catch(() => undefined)
      if (persist) await deleteDemoDatabase()
      throw err
    }
  }
  timings.total = performance.now() - t0
  return { backend, pg, firstBoot, timings }
}
