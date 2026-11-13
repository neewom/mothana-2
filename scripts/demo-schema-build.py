"""Spike démo PGlite : transforme la sortie JSON de demo-schema-dump.sql en un fichier SQL rejouable."""
import json
import sys

rows = json.load(open(sys.argv[1]))["rows"]
print("-- Généré par scripts/demo-schema-build.py (spike démo PGlite) — ne pas éditer à la main.")
print("set check_function_bodies = off;")
print("create extension if not exists unaccent with schema extensions;")
# pgcrypto n'est pas chargé dans la démo (-1,1 Mo) : seul gen_random_bytes est utilisé (code PIN).
print("create or replace function extensions.gen_random_bytes(n integer) returns bytea language sql volatile as "
      "$$ select substring(decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex') from 1 for n) $$;")
for r in rows:
    # PGlite est compilé sans ICU : le tri français de deux fonctions (search_path vide,
    # donc pas d'alias possible) devient un tri binaire dans la démo.
    print(r["ddl"].replace('collate "fr-x-icu"', 'collate "C"'))
