# Catalogue des bloquants (Mothana)

Lu par le sous-agent relecteur (`docs/relecteur.md`, boucle de relecture du workflow v2.1, `AGENTS.md`). Chaque bloquant trouvé **après** la boucle (revue du lead tech, test de l'utilisateur, incident) s'ajoute ici : famille, exemple, question à se poser. Mesure : bloquants trouvés après la boucle, par PR, objectif 0. Exemples de départ : bloquants déjà rencontrés sur le projet (détail dans `docs/journal-avancement.md`).

## 1. Effet sur une autre fonction (lire le code autour, pas le diff seul)
- Opt-out mailing : la liste des adhérents passe par la RPC `search_adherents`, qui ne renvoyait pas la nouvelle colonne → la modale recevait `undefined` et la case restait décochée.
- `organisations.slug` rendu `NOT NULL` sans que `OrgModal.tsx` le renseigne → création d'organisation cassée en prod.
- `mode_paiement` passé de texte à `smallint` côté admin, mais `generate-recu` et le formulaire bénévole envoyaient encore du texte → reçus et dons bénévoles impossibles.
- Suppression d'une organisation : cascade sur `profils_organisation` mais pas sur `auth.users` → comptes admin orphelins.
- Question : **qui d'autre lit ou écrit ce que je change** (RPC qui renvoient la ligne, Edge Functions, imports, autres écrans, reçus PDF, autres rôles) ? Chercher tous les lecteurs et vérifier leur hypothèse.

## 2. Valeurs vides, absentes ou par défaut
- Gardes SQL `if not (<condition>)` sur `current_user_organisation_id()` / `current_user_role()` / `is_current_user_super_admin()` : NULL pour une session bénévole → la garde ne lève pas → faille inter-organisations (`get_org_admins`, en prod).
- Un seul email mal formé dans la liste → toute la campagne Brevo refusée (341 destinataires).
- Renouvellement lancé depuis une ligne de `search_adherents` sans `organisation_id` → insertion échouée.
- Question : que se passe-t-il avec `null`, chaîne vide, 0, civilité 0/255, date absente, organisation sans clé Brevo, session sans `profils_organisation` ? Toute garde SQL est-elle `if not coalesce(…, false)` avec un test en session bénévole ?

## 3. Une règle d'AGENTS.md tenue par la prose seulement
- `next_adherent_id_externe` / `next_participant_id_externe` grantées à `authenticated` sans garde interne d'organisation : seule l'UI admin les appelait.
- Policies RLS avec le bypass super-admin sur certaines opérations seulement.
- Question : chaque règle touchée (RLS organisation-scopée + bypass super-admin sur les 4 opérations, aucune écriture anonyme sensible, flag de fonctionnalité, `service_role` jamais côté client, rôles admin/contributeur) est-elle **tenue en base ou côté serveur** (policy, garde, test SQL), pas seulement par le front ?

## 4. Cas multiples et concurrence
- `AuthContext` : `loginAdmin` et le listener `onAuthStateChange` réagissaient tous deux à `SIGNED_IN` → double `signOut()` et mauvais message.
- Donateur créé au clic « Confirmer », avant la validation du don → donateur fantôme si le don est annulé.
- Sujet d'email identique pour chaque achat → Gmail regroupe en conversation et masque le lien du portefeuille.
- Question : et s'il y en a **deux** (onglets, organisations, comptes, envois, clics, appels concurrents, PR qui touchent la même Edge Function) ? L'écriture a-t-elle lieu au bon moment, une seule fois ?

## 5. Une source moins fiable qui décide pour une plus fiable
- `profils_participant.id_externe` (rempli seulement pour les participants importés) utilisé comme numéro de donateur.
- `app_metadata` du compte bénévole posé à la création seulement → rôle périmé décidait de l'accès (corrigé par un self-heal dans `verify-pin`).
- Date de fin d'adhésion : la base (`calculer_date_fin_adhesion`) fait foi, le calcul front n'est qu'un miroir → relire la valeur en base après insertion.
- Question : quand deux données disent des choses différentes (front / base, JWT / table, import / saisie), laquelle fait foi, et la moins fiable peut-elle décider ?

## 6. Instructions contradictoires
- Ticket, `AGENTS.md`, `DESIGN.md` et commentaires du code peuvent se contredire (ex. alerte d'action requise en ambre, pas l'indigo de la marque ; pas de `max`/`min` HTML bloquant).
- Question : le code suit-il la règle la plus récente et la plus précise ? Une exception du ticket contredit-elle une règle d'`AGENTS.md` sans que ce soit dit ?

## 7. Erreurs avalées, valeurs par défaut dangereuses
- Achat simulé : portefeuille crédité mais lien perdu si l'envoi de l'email échoue, sans erreur visible.
- Suppression de la branche `dev` → la recette basculerait silencieusement sur les identifiants prod (variables Vercel scopées par nom de branche).
- Question : chaque erreur (Supabase, Brevo, Resend, Gotenberg, Edge Function) est-elle remontée avec un message utile, sans laisser un état à moitié écrit ? Un paramètre manquant tombe-t-il sur un défaut sûr ?

## 8. Juste en local, faux dans le vrai contexte d'usage
- `crypto.subtle` et `navigator.clipboard` indisponibles sur l'URL HTTP par IP (Tailscale) alors qu'ils marchent sur `localhost`.
- Redirections d'authentification Supabase vers une IP littérale : échec silencieux.
- `type="number"` sur un téléphone : zéros de tête perdus ; sélecteurs de date mobiles bloqués par `max`/`min`.
- Question : comment se comporte la fonction sur un **téléphone**, en HTTP non sécurisé, à 375 px, sur de vraies données d'association (accents, mojibake, 300 destinataires) ? L'erreur va-t-elle dans le sens sûr ?
