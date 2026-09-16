# CLAUDE.md — Mothana (Gestion des dons)

@AGENTS.md

Le contenu portable (contexte projet, conventions, sécurité, Git, Trello, backlog) vit dans `AGENTS.md`, importé ci-dessus — Claude Code le charge automatiquement au démarrage de la session, comme s'il était écrit directement ici. Ce fichier-ci ne garde que ce qui est spécifique à Claude Code ; `AGENTS.md` reste lisible/utilisable tel quel par un autre agent (ex. Codex) en cas de handoff.

---

## Mémoire persistante

En complément d'`AGENTS.md`, Claude Code dispose d'un système de mémoire automatique (`~/.claude/projects/.../memory/`, index `MEMORY.md`) qui accumule au fil des sessions des préférences de collaboration, des identifiants (ex. credentials Trello dans `.env`), et des règles apprises. Ce système n'a pas d'équivalent pour un autre agent — toute règle de fonctionnement *durable et utile au projet* (pas une préférence de collaboration) doit donc aussi être reflétée dans `AGENTS.md`, pas seulement mémorisée ici (règle mémorisée : `feedback_agents_md_sync_load_bearing_rules`).

## Outils spécifiques à Claude Code

- Skill `.claude/skills/webapp-testing/` disponible pour les vérifications navigateur (Playwright Python) — son propre helper `scripts/with_server.py` sait démarrer/arrêter un serveur, mais **ne pas l'utiliser dans ce projet** puisqu'une instance tourne déjà en permanence (voir `AGENTS.md` → Environnement de développement) : suivre la branche "serveur déjà en cours → reconnaissance puis action" de son arbre de décision, jamais la branche "démarrer un serveur"

---

Règles génériques de collaboration (rythme de travail, git/PR, continuité entre sessions) valables sur tous mes projets, pas seulement Mothana : voir `~/.claude/CLAUDE.md`.
