-- Spike démo PGlite : reconstruit le DDL du schéma public depuis le catalogue (lecture seule).
-- Usage : npx supabase db query --linked -f scripts/demo-schema-dump.sql > /tmp/ddl.json
--         python3 scripts/demo-schema-build.py /tmp/ddl.json > src/demo/schema.sql

with ns as (select 'public'::regnamespace as oid),
ext_objs as (select objid from pg_depend where deptype='e'),
enums as (
  select 10 as ord, t.typname::text as name,
   format('create type public.%I as enum (%s);', t.typname,
     (select string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) as ddl
  from pg_type t where t.typnamespace=(select oid from ns) and t.typtype='e' and t.oid not in (select objid from ext_objs)
),
comps as (
  select 11, t.typname::text,
   format('create type public.%I as (%s);', t.typname,
     (select string_agg(format('%I %s', a.attname, format_type(a.atttypid,a.atttypmod)), ', ' order by a.attnum) from pg_attribute a where a.attrelid=t.typrelid and a.attnum>0 and not a.attisdropped))
  from pg_type t join pg_class c on c.oid=t.typrelid where t.typnamespace=(select oid from ns) and t.typtype='c' and c.relkind='c'
),
seqs as (
  select 20, c.relname::text, format('create sequence if not exists public.%I;', c.relname)
  from pg_class c where c.relnamespace=(select oid from ns) and c.relkind='S'
   and not exists (select 1 from pg_depend d where d.objid=c.oid and d.deptype in ('a','i') and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass)
),
tabs as (
  select 30, c.relname::text,
   format('create table public.%I (%s);', c.relname,
    coalesce((select string_agg(
      format('%I %s%s%s', a.attname, format_type(a.atttypid,a.atttypmod),
        case when a.attidentity in ('a','d') then ' generated '||case a.attidentity when 'a' then 'always' else 'by default' end||' as identity'
             when a.attgenerated='s' then ' generated always as ('||pg_get_expr(ad.adbin, ad.adrelid)||') stored' else '' end,
        case when a.attnotnull then ' not null' else '' end), ', ' order by a.attnum)
     from pg_attribute a left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
     where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),''))
  from pg_class c where c.relnamespace=(select oid from ns) and c.relkind in ('r','p')
),
defaults as (
  select 50, c.relname||'.'||a.attname, format('alter table public.%I alter column %I set default %s;', c.relname, a.attname, pg_get_expr(ad.adbin, ad.adrelid))
  from pg_attrdef ad join pg_class c on c.oid=ad.adrelid join pg_attribute a on a.attrelid=ad.adrelid and a.attnum=ad.adnum
  where c.relnamespace=(select oid from ns) and c.relkind in ('r','p') and a.attidentity='' and a.attgenerated=''
),
funcs as (
  select 40, p.proname::text, pg_get_functiondef(p.oid)||';'
  from pg_proc p where p.pronamespace=(select oid from ns) and p.prokind in ('f','p') and p.oid not in (select objid from ext_objs)
),
views as (
  select 45, c.relname::text, format('create or replace view public.%I%s as %s', c.relname,
     case when c.reloptions is not null then ' with ('||array_to_string(c.reloptions, ', ')||')' else '' end, pg_get_viewdef(c.oid))
  from pg_class c where c.relnamespace=(select oid from ns) and c.relkind='v'
),
cons as (
  select case when co.contype='f' then 70 else 60 end, co.conname::text,
   format('alter table public.%I add constraint %I %s;', c.relname, co.conname, pg_get_constraintdef(co.oid))
  from pg_constraint co join pg_class c on c.oid=co.conrelid where c.relnamespace=(select oid from ns) and co.contype in ('p','u','c','f','x')
),
idx as (
  select 80, ic.relname::text, pg_get_indexdef(i.indexrelid)||';'
  from pg_index i join pg_class ic on ic.oid=i.indexrelid join pg_class c on c.oid=i.indrelid
  where c.relnamespace=(select oid from ns) and not exists (select 1 from pg_constraint co where co.conindid=i.indexrelid and co.contype in ('p','u','x'))
),
trg as (
  select 90, t.tgname::text, pg_get_triggerdef(t.oid)||';'
  from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace=(select oid from ns) and not t.tgisinternal
),
rls as (
  select 95, c.relname::text, format('alter table public.%I enable row level security;', c.relname)
  from pg_class c where c.relnamespace=(select oid from ns) and c.relkind in ('r','p') and c.relrowsecurity
),
pols as (
  select 96, p.policyname::text,
   format('create policy %I on public.%I as %s for %s to %s%s%s;', p.policyname, p.tablename, p.permissive, p.cmd,
     array_to_string(p.roles, ', '),
     case when p.qual is not null then ' using ('||p.qual||')' else '' end,
     case when p.with_check is not null then ' with check ('||p.with_check||')' else '' end)
  from pg_policies p where p.schemaname='public'
),
fgrants as (
  select 98, p.proname::text,
   format('revoke execute on function %s from public, anon, authenticated;%s', p.oid::regprocedure,
     coalesce((select string_agg(format(' grant execute on function %s to %s;', p.oid::regprocedure, case when a.grantee=0 then 'public' else a.grantee::regrole::text end), '')
       from aclexplode(p.proacl) a where a.privilege_type='EXECUTE' and (a.grantee=0 or a.grantee::regrole::text in ('anon','authenticated','service_role'))), ''))
  from pg_proc p where p.pronamespace=(select oid from ns) and p.prokind in ('f','p') and p.oid not in (select objid from ext_objs) and p.proacl is not null
)
select * from (select * from enums union all select * from comps union all select * from seqs union all select * from tabs union all select * from defaults union all select * from funcs union all select * from views union all select * from cons union all select * from idx union all select * from trg union all select * from rls union all select * from pols union all select * from fgrants) x order by 1, 2
