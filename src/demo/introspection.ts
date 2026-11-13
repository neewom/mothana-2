// tinbase introspecte le schéma (tables, clés, FK) via information_schema
// à la première requête REST : ~10 s sous Node et ~20 s dans le navigateur avec nos 37 tables.
// Ces requêtes équivalentes sur pg_catalog renvoient les mêmes colonnes en quelques ms.

const FAST: [string, string][] = [
  [
    'from information_schema.columns',
    `select c.relname as table_name, a.attname as column_name, t.typname as udt_name,
            case when a.attnotnull then 'NO' else 'YES' end as is_nullable,
            ad.adbin is not null as has_default
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_type t on t.oid = a.atttypid
       left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
      where n.nspname = $1 and c.relkind in ('r', 'v', 'm', 'p', 'f') and a.attnum > 0 and not a.attisdropped
      order by a.attnum`,
  ],
  [
    "constraint_type = 'PRIMARY KEY' and tc.table_schema",
    `select c.relname as table_name, a.attname as column_name
       from pg_constraint co
       join pg_class c on c.oid = co.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       cross join lateral unnest(co.conkey) as k(attnum)
       join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where co.contype = 'p' and n.nspname = $1`,
  ],
  [
    "constraint_type in ('PRIMARY KEY', 'UNIQUE')",
    `select c.relname as table_name, co.conname as constraint_name, a.attname as column_name, k.ord as ordinal
       from pg_constraint co
       join pg_class c on c.oid = co.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       cross join lateral unnest(co.conkey) with ordinality as k(attnum, ord)
       join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where co.contype in ('p', 'u') and n.nspname = $1
      order by co.conname, k.ord`,
  ],
  [
    "constraint_type = 'FOREIGN KEY'",
    `select co.conname as constraint_name, sn.nspname as src_schema, sc.relname as src_table, sa.attname as src_column,
            tn.nspname as tgt_schema, tc.relname as tgt_table, ta.attname as tgt_column, k.ord as ordinal
       from pg_constraint co
       join pg_class sc on sc.oid = co.conrelid
       join pg_namespace sn on sn.oid = sc.relnamespace
       join pg_class tc on tc.oid = co.confrelid
       join pg_namespace tn on tn.oid = tc.relnamespace
       cross join lateral unnest(co.conkey, co.confkey) with ordinality as k(sk, tk, ord)
       join pg_attribute sa on sa.attrelid = sc.oid and sa.attnum = k.sk
       join pg_attribute ta on ta.attrelid = tc.oid and ta.attnum = k.tk
      where co.contype = 'f' and (sn.nspname = $1 or tn.nspname = $1)
      order by co.conname, k.ord`,
  ],
]

export function fastIntrospection(sql: string): string {
  if (!sql.includes('information_schema')) return sql
  for (const [marker, replacement] of FAST) if (sql.includes(marker)) return replacement
  return sql
}
