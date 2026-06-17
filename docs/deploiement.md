# Guide de déploiement — Mothana

## Prérequis

- Compte [Supabase](https://supabase.com) (plan Free ou Pro)
- Compte [Vercel](https://vercel.com) (plan Hobby ou Pro)
- Node.js 18+ et npm

---

## 1. Supabase — initialisation

### 1.1 Créer le projet

1. Créer un nouveau projet sur [supabase.com](https://supabase.com)
2. Choisir une région proche de tes utilisateurs
3. Récupérer dans **Project Settings → API** :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon / public` → `VITE_SUPABASE_ANON_KEY`
   - `service_role` → à conserver pour les Edge Functions (ne jamais commiter)

### 1.2 Initialiser la base de données

Dans **SQL Editor**, exécuter dans l'ordre :

```
1. docs/schema-mothana.sql         — tables, RLS, seed de démo
2. supabase/migrations/super_admin_rls.sql  — policies super-admin
```

### 1.3 Créer le bucket Storage

Dans **Storage**, créer un bucket `recus-fiscaux` :
- Public : **non**
- Policy : accès lecture/écriture aux utilisateurs authentifiés de l'organisation

SQL à exécuter dans **SQL Editor** :

```sql
insert into storage.buckets (id, name, public)
values ('recus-fiscaux', 'recus-fiscaux', false);

create policy "recus_storage_admin"
  on storage.objects for all
  using (
    bucket_id = 'recus-fiscaux'
    and (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (
      bucket_id = 'recus-fiscaux'
      and (storage.foldername(name))[1] = (
        select organisation_id::text
        from profils_organisation
        where utilisateur_id = auth.uid()
        limit 1
      )
    )
  );
```

### 1.4 Créer les comptes utilisateurs

**Compte admin de démo** :
1. Dans **Authentication → Users**, créer un utilisateur (email + mot de passe)
2. Dans **SQL Editor** :

```sql
insert into profils_organisation (utilisateur_id, organisation_id, nom_affiche, role)
values ('<uuid-utilisateur>', '00000000-0000-0000-0000-000000000001', 'Admin Mothana', 'admin');
```

**Compte super-admin** :
```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb
where email = 'email-du-super-admin@exemple.com';
```

---

## 2. Edge Functions — déploiement

Les Edge Functions sont dans `supabase/functions/`. Elles nécessitent la CLI Supabase.

### 2.1 Installer la CLI

```bash
npm install -g supabase
supabase login
```

### 2.2 Déployer les fonctions

```bash
supabase functions deploy verify-pin --project-ref <project-ref>
supabase functions deploy generate-recu --project-ref <project-ref>
supabase functions deploy update-pin --project-ref <project-ref>
```

Le `project-ref` est visible dans l'URL du dashboard Supabase : `https://supabase.com/dashboard/project/<project-ref>`.

### 2.3 Configurer les secrets

Dans **Project Settings → Edge Functions → Secrets**, ajouter :

| Clé | Valeur |
|-----|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | La clé `service_role` du projet |

> Les variables `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont injectées automatiquement.

---

## 3. Frontend — déploiement sur Vercel

### 3.1 Variables d'environnement

Dans Vercel (**Settings → Environment Variables**), ajouter :

| Variable | Valeur |
|----------|--------|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé `anon / public` |

### 3.2 Déploiement

Connecter le dépôt GitHub à Vercel. Vercel détecte automatiquement Vite.

Paramètres de build (normalement auto-détectés) :
- **Build Command** : `npm run build`
- **Output Directory** : `dist`
- **Install Command** : `npm install`

> Chaque push sur `main` déclenche un déploiement automatique.

---

## 4. Vérifications post-déploiement

- [ ] Connexion admin → redirection vers `/admin/dons`
- [ ] Connexion super-admin → redirection vers `/super-admin`
- [ ] Connexion bénévole avec PIN → accès écran de saisie
- [ ] Ajout d'un don depuis le dashboard admin
- [ ] Génération d'un reçu fiscal PDF
- [ ] Régénération du PIN bénévole → accès avec l'ancien PIN bloqué, nouveau PIN fonctionnel

---

## 5. Fichiers sensibles

| Fichier | À ne jamais commiter |
|---------|----------------------|
| `.env` | Contient `VITE_SUPABASE_ANON_KEY` |
| Clé `service_role` | Uniquement dans les secrets Edge Functions et Vercel (si besoin) |

Le fichier `.gitignore` exclut déjà `.env`.
