# 2026-10-08 — Lead tech : passage à Claude Code dev, cadrage batch Coupon UX + RGPD, recherche paiement

Session lead tech (« Mothana - TL »). Fichier distinct de celui du dev.

## Réalisé
- Workflow TL > dev Claude Code repris de Panda Scoring (PR #207 mergée, PR #208 variante « batch empilé » + noms de sessions, en attente de merge). Codex écarté.
- Worktree dev `../mothana-2-claude-dev` créé ; ancien worktree `../mothana-2-codex` supprimé ; 112 branches locales mergées supprimées.
- Cartes Coupon UX (vMMcdMbm) et RGPD (OJvbKKKV) préfixées [M], placées dans la liste « Batch — Coupon UX + RGPD (empilé) ». RGPD : 18 mois par défaut paramétrable par organisation, purge par cron pg_cron quotidien, action Anonymiser dans le panneau de détail.
- Batch Coupon UX + RGPD terminé et mergé : #209 (après itération test utilisateur : en-tête événement, liste cliquable, crédit manuel réservé au super-admin + trigger fermant l'écriture admin de `fonctionnalites_activees`) et #210 (RGPD ; mention publique corrigée par le lead tech ; purge testée en réel sur staging à M-19/M-17).
- Règle de merge assouplie (Mothana) : le lead tech merge après l'« ok » de l'utilisateur ; en batch dev, merges à la fin de la revue du batch.
- Recherche web paiement consignée sur la carte 6 (seuil ACPR par émetteur, précédents cashless HelloAsso, exploration API HelloAsso) ; contact HelloAsso **en suspens**.
- Nouvelle carte Coupon « Report du solde vers l'événement suivant » (zfXIwdkh), non cadrée, bloquée par l'avis juridique.

## Reste à faire — ⚠️ action planifiée
**Batch UX + RGPD mergé le 2026-10-08 → prochaine étape : promotion `dev` → `main` EN BLOC (décision utilisateur 2026-10-08), Coupon tel quel**, avec ces garde-fous :
1. **Vérifier que `SIMULATION_PAIEMENT_ACTIVE` n'est PAS défini/actif dans les secrets Edge Functions de prod** (achat gratuit illimité sinon). Ne jamais le copier depuis staging.
2. **Vérifier que le flag `evenements` reste désactivé pour toutes les organisations de prod** (défaut false) — le module ne doit être visible par personne.
3. Appliquer en prod **toutes** les migrations Coupon + sécurité dans l'ordre (12 au 2026-10-08 + `coupon_credit_manuel_flag.sql` + `coupon_rgpd_anonymisation.sql`), y compris l'activation de l'extension **pg_cron** et la planification du cron RGPD (tâche permanente, décision utilisateur). Le trigger `trg_organisations_fonctionnalites_super_admin` fait partie des garde-fous : sans lui un admin peut s'activer `evenements` lui-même.
4. Déployer explicitement en prod toutes les Edge Functions nouvelles/modifiées (8 au 2026-10-08 : coupon-transport-spike, decider-portefeuille-paiement, generate-portefeuille-qr-pdf, get-portefeuille, renvoyer-acces-portefeuille, simuler-achat-evenement, update-pin, verify-pin — + celles modifiées par le batch).
5. Merge de la PR de promotion en `--merge`, **sans jamais supprimer la branche `dev`**.
6. Rappeler à l'utilisateur ce qui reste requis **avant d'activer `evenements` chez une vraie association** (pas avant la promotion) : contrat de sous-traitance art. 28, politique de confidentialité rédigée (le dev ne pose que le lien), décision paiement carte 6, avis juridique.
La promotion embarque aussi des correctifs de sécurité qui protègent la prod actuelle (rate limit verify-pin #195, durcissement EXECUTE des RPC ouvertes à anon, garde d'organisation `next_*_id_externe` #199).

## Blockers
- Carte 6 (prestataire de paiement) : contact HelloAsso/Stripe/juriste en suspens, décision utilisateur.

## Décisions
- Durée de conservation RGPD : 18 mois par défaut, paramétrable par organisation.
- Purge RGPD : cron Supabase quotidien.
- Batch empilé UX → RGPD.
- Promotion Coupon en bloc après le batch, avec les garde-fous ci-dessus.
