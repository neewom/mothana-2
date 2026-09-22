-- Audit des droits EXECUTE des RPC existantes (carte Trello zb20DQpc).
-- Plusieurs fonctions security definer créées avant l'introduction du
-- pattern "revoke public/anon/authenticated puis grant explicite" (visible
-- sur les migrations Coupon) sont restées exécutables par anon via
-- PostgREST, alors qu'elles ne devraient jamais l'être : soit purement
-- outillage interne, soit toujours appelées par un client authentifié ou
-- par service_role. Aucune des fonctions ci-dessous n'a de trou
-- d'autorisation exploitable en pratique (celles avec une garde interne
-- lèvent 'Unauthorized' pour un appelant anon), mais deux — les
-- générateurs de séquence — n'ont aucune garde du tout : un appelant
-- anonyme pouvait faire avancer la séquence de numérotation des reçus
-- fiscaux ou des id_externe de n'importe quelle organisation.

-- Outil d'audit interne (lit pg_policies), jamais appelé depuis le
-- frontend/Edge Functions — aucune raison d'être exposé au-delà de service_role.
revoke execute on function public.audit_missing_super_admin_bypass() from public, anon, authenticated;
grant execute on function public.audit_missing_super_admin_bypass() to service_role;

-- Toujours appelée par un client authentifié (AdminAccountsManager.tsx).
-- Garde interne déjà correcte (admin de l'org ou super-admin) : durcissement en profondeur.
revoke execute on function public.get_org_admins(uuid) from public, anon;
grant execute on function public.get_org_admins(uuid) to authenticated, service_role;

-- Toujours appelées par un client authentifié (ImportWizard). Gardes internes
-- déjà correctes (v_org is null -> Unauthorized) : durcissement en profondeur.
revoke execute on function public.import_upsert_activites(jsonb, uuid) from public, anon;
grant execute on function public.import_upsert_activites(jsonb, uuid) to authenticated, service_role;
revoke execute on function public.import_upsert_adherents(jsonb, uuid) from public, anon;
grant execute on function public.import_upsert_adherents(jsonb, uuid) to authenticated, service_role;
revoke execute on function public.import_upsert_dons(jsonb, uuid) from public, anon;
grant execute on function public.import_upsert_dons(jsonb, uuid) to authenticated, service_role;
revoke execute on function public.import_upsert_participants(jsonb, uuid) from public, anon;
grant execute on function public.import_upsert_participants(jsonb, uuid) to authenticated, service_role;

-- Aucune garde interne : un appelant anonyme pouvait consommer la séquence
-- id_externe de n'importe quelle organisation. Toujours appelées par un
-- client authentifié (AdherentModal.tsx, ParticipantModal.tsx).
revoke execute on function public.next_adherent_id_externe(uuid) from public, anon;
grant execute on function public.next_adherent_id_externe(uuid) to authenticated, service_role;
revoke execute on function public.next_participant_id_externe(uuid) from public, anon;
grant execute on function public.next_participant_id_externe(uuid) to authenticated, service_role;

-- Aucune garde interne : un appelant anonyme pouvait faire avancer la
-- numérotation des reçus fiscaux (obligation légale de continuité) de
-- n'importe quelle organisation/année, sans même générer de reçu. Toujours
-- appelée par generate-recu via adminClient (service_role).
revoke execute on function public.next_numero_recu(uuid, integer) from public, anon, authenticated;
grant execute on function public.next_numero_recu(uuid, integer) to service_role;
