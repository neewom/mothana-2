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

## Promotion faite le 2026-10-08 (PR #212)
Garde-fous 1-5 vérifiés et appliqués ; 14 migrations + 7 Edge Functions en prod ; incident `PORTEFEUILLE_RATE_LIMIT_KEY` manquant en prod (verify-pin 503) corrigé dans la foulée. Dump prod d'avant promotion conservé localement (scratchpad de session). Instance permanente 5173 retirée (PR #211) ; PR exclusivement doc mergées directement par le lead tech.

## (Historique) Reste à faire — action planifiée
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

## Suite de session (après la promotion Coupon)
- Étude Neon vs Supabase : migration écartée. Supabase réorganisé : prod seule en organisation « Chithda » passée en **Pro** (sauvegardes quotidiennes, plus de pause), recette dans « Chithda recette » en gratuit ; projet `pagode-coupon` supprimé après sauvegarde par l'utilisateur.
- Instance permanente 5173 retirée : l'utilisateur teste uniquement via les liens worktree + plans de test du lead tech. PR exclusivement doc : mergées directement par le lead tech.
- Listes Trello « In progress » / « To review » ajoutées par l'utilisateur et intégrées au workflow.
- Quota Vercel atteint (compte gratuit partagé avec Panda Scoring) → previews coupées, seuls `dev` et `main` déploient (#224).
- Batch « Tri des dons + design system » mergé sur `dev` ; correctif import de dons promu seul en prod (#225). Listes Trello du batch et « Uniformisation design system » archivées (vides).

## Reste à faire
- Batchs UX suivants, dans l'ordre validé : **Navigation** (barre du haut [M] → menu [M] → Paramètres [L] → recherche globale [L]) puis **Pages de liste** (gabarit [L] → filtres Adhérents [M] → retouches [M]). Cartes dans la liste « Amélioration UX/UI », tailles posées, tickets à relire contre le code avant chaque go.
- Batch design system et tri des dons : sur `dev`, pas encore en prod (prochaine promotion).
- Carte 6 Coupon (paiement) : contact HelloAsso en suspens.

## Suite (2026-10-09 → 2026-10-10)
- Batch Navigation (#227–#230) puis batch Rôles + pages de liste (#232–#237) mergés sur `dev`, avec plusieurs tours de retours utilisateur intégrés en test (rôle affiché, tuiles Dons retirées, actions de page alignées, recherche sur les listes longues).
- Promotion en bloc des trois batchs UX en prod (#239) : 3 migrations, 2 Edge Functions, build Vercel OK. Liste « Amélioration UX/UI » soldée et archivée.
- Carte Backlog créée : migration vers un data router (bouton retour non intercepté par la garde « modifications non enregistrées »).

## Reste à faire
- Todo : campagne mailing incluant les donateurs, multi-organisation (reporté), factorisation Courrier/Mailing (reportée), email aux admins sur demande d'adhésion, export comptable (lointain).
- Coupon : carte 6 (paiement, contact HelloAsso en suspens), cartes 7/8 bloquées, report du solde (avis juridique).
