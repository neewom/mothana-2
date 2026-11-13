#!/usr/bin/env bash
# Démo publique : régénère src/demo/schema.sql depuis le catalogue de STAGING (lecture seule).
# Usage : npm run demo:schema   (depuis la racine d'un checkout lié à staging)
# Ensuite : changer DATA_VERSION dans src/demo/backend.ts si le fichier a changé, puis
# `npm run demo:smoke`.
set -euo pipefail

STAGING_REF="cxngcmvxktddhyxboyyx"
cd "$(dirname "$0")/.."

# `supabase db query --linked` choisit le projet d'après supabase/.temp/project-ref ;
# linked-project.json est contrôlé aussi : les deux doivent désigner staging.
ref_file="supabase/.temp/project-ref"
json_file="supabase/.temp/linked-project.json"
ref="$( { tr -d '[:space:]' <"$ref_file"; } 2>/dev/null || true)"
linked="$(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["ref"])' "$json_file" 2>/dev/null || true)"
if [ "$ref" != "$STAGING_REF" ] || [ "$linked" != "$STAGING_REF" ]; then
  echo "demo:schema : ce checkout doit être lié à staging ($STAGING_REF)." >&2
  echo "             $ref_file : « ${ref:-absent ou vide} » ; $json_file : « ${linked:-absent ou illisible} »." >&2
  echo "             L'instantané ne se lit jamais en prod." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Une seule requête SELECT sur le catalogue (pg_class, pg_proc, pg_policies…) : aucune ligne de donnée.
npx supabase db query --linked --output-format json -f scripts/demo-schema-dump.sql >"$tmp/dump.json" 2>"$tmp/err.txt" || {
  cat "$tmp/err.txt" >&2
  exit 1
}
python3 -I scripts/demo-schema-build.py "$tmp/dump.json" "$tmp/schema.sql"
mv "$tmp/schema.sql" src/demo/schema.sql

if git diff --quiet -- src/demo/schema.sql; then
  echo "demo:schema : instantané inchangé."
else
  git --no-pager diff --stat -- src/demo/schema.sql
  echo "demo:schema : instantané modifié — changer DATA_VERSION dans src/demo/backend.ts, puis npm run demo:smoke."
fi
