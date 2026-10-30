#!/usr/bin/env bash
# Crée (une seule fois) le worktree persistant d'un agent : ../mothana-2-<agent>
# Usage : scripts/agent-worktree.sh <agent>   (ex. claude-dev, review)
# Ensuite, par carte : cd ../mothana-2-<agent> && git switch -c <branche> origin/dev
set -euo pipefail

agent="${1:?usage: scripts/agent-worktree.sh <agent>}"
main="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
dir="$(dirname "$main")/mothana-2-$agent"

if [ -e "$dir" ]; then
  echo "Existe déjà : $dir" >&2
  exit 1
fi

git fetch origin dev
git worktree add --detach "$dir" origin/dev

# Fichiers non versionnés que git ne transporte pas dans un worktree
# Accès prod (PROD_*) réservé au worktree de revue du lead tech : retiré des autres
if [ -f "$main/.env" ]; then
  if [ "$agent" = "review" ]; then cp "$main/.env" "$dir/.env"; else grep -v '^PROD_' "$main/.env" > "$dir/.env"; fi
fi
[ -d "$main/supabase/.temp" ] && mkdir -p "$dir/supabase/.temp" && cp -R "$main/supabase/.temp/." "$dir/supabase/.temp/"

(cd "$dir" && npm install --no-audit --no-fund)
(cd "$dir" && graphify update . >/dev/null 2>&1 || true)

echo "Worktree prêt : $dir"
