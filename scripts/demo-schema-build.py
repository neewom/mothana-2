"""Démo publique : transforme la sortie JSON de demo-schema-dump.sql en src/demo/schema.sql.

Usage (via `npm run demo:schema`, cf. scripts/demo-schema.sh) :
    python3 -I scripts/demo-schema-build.py <sortie JSON de db query> <fichier SQL à écrire>

Sortie déterministe : les instructions sont triées (catégorie, nom, texte) indépendamment de la
collation de la base, donc deux régénérations sur le même schéma donnent un fichier identique.
Le script refuse d'écrire un instantané qui contiendrait un identifiant d'organisation (UUID).
"""
import json
import re
import sys

UUID = re.compile(r"[0-9a-f]{8}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{12}", re.I)
# PGlite est compilé sans ICU : le tri français (search_path vide, donc pas d'alias possible)
# devient un tri binaire dans la démo.
ICU_COLLATION = re.compile(r'collate "fr-x-icu"', re.I)
# Objets dont la démo ne peut pas se passer : un instantané qui ne les contient pas est faux.
REQUIRED_TABLES = ("organisations", "dons", "personnes", "profils_participant", "adherents", "adhesions")

HEADER = [
    "-- Généré par `npm run demo:schema` (scripts/demo-schema-dump.sql + scripts/demo-schema-build.py)",
    "-- depuis le catalogue de staging — ne pas éditer à la main. Changer DATA_VERSION (backend.ts).",
    "set check_function_bodies = off;",
    "create extension if not exists unaccent with schema extensions;",
    # pgcrypto n'est pas chargé dans la démo (-1,1 Mo) : seul gen_random_bytes est utilisé (code PIN).
    "create or replace function extensions.gen_random_bytes(n integer) returns bytea language sql volatile as "
    "$$ select substring(decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex') from 1 for n) $$;",
]


def fail(message: str) -> None:
    print(f"demo-schema-build : {message}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage : demo-schema-build.py <dump.json> <schema.sql>")
    try:
        with open(sys.argv[1], encoding="utf-8") as f:
            rows = json.load(f)["rows"]
    except (OSError, ValueError, KeyError) as err:
        fail(f"sortie de db query illisible ({err})")
    if not rows:
        fail("le catalogue n'a renvoyé aucune instruction")

    rows.sort(key=lambda r: (int(r["ord"]), r["name"], r["ddl"]))
    statements = [ICU_COLLATION.sub('collate "C"', r["ddl"]) for r in rows]

    tables = {r["name"] for r in rows if int(r["ord"]) == 30}
    missing = [t for t in REQUIRED_TABLES if t not in tables]
    if missing:
        fail(f"tables attendues absentes du catalogue : {', '.join(missing)}")

    leaks = sorted({m.group(0) for s in statements for m in UUID.finditer(s)})
    if leaks:
        fail("identifiant(s) d'organisation dans l'instantané, rien n'est écrit : " + ", ".join(leaks))

    with open(sys.argv[2], "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(HEADER + statements) + "\n")
    print(f"instantané : {len(statements)} instructions, {len(tables)} tables", file=sys.stderr)


main()
