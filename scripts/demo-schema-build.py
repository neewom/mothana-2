"""Spike démo PGlite : transforme la sortie JSON de demo-schema-dump.sql en un fichier SQL rejouable."""
import json
import sys

rows = json.load(open(sys.argv[1]))["rows"]
print("-- Généré par scripts/demo-schema-build.py (spike démo PGlite) — ne pas éditer à la main.")
print("set check_function_bodies = off;")
print("create extension if not exists unaccent with schema extensions;")
for r in rows:
    print(r["ddl"])
