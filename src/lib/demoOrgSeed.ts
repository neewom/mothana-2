import { supabase } from './supabaseClient'

// Jeu de données factice inséré automatiquement à la création d'une organisation
// sur l'environnement de recette/staging (cf. carte Trello a8PK4LX9, cadrée 2026-08-22).
// Gabarit fixe inspiré d'"Association Démo Staging" : quelques adhérents à statuts
// variés, quelques dons, quelques activités, quelques donateurs.

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function seedDemoOrganisationData(organisationId: string): Promise<void> {
  const { data: activites, error: activitesErr } = await supabase
    .from('activites')
    .insert([
      { organisation_id: organisationId, nom: 'Cérémonie du Nouvel An Lao', date_debut: daysAgo(120) },
      { organisation_id: organisationId, nom: 'Collecte de dons trimestrielle', date_debut: daysAgo(30) },
    ])
    .select('id')
  if (activitesErr) throw activitesErr
  const [activiteCeremonie, activiteCollecte] = activites

  const { data: personnes, error: personnesErr } = await supabase
    .from('personnes')
    .insert([
      { civilite: 1, nom: 'Keovongsa', prenom: 'Somchai', email: 'somchai.keovongsa@example.com', telephone: '0612345678' },
      { civilite: 2, nom: 'Dubois', prenom: 'Marie', email: 'marie.dubois@example.com' },
      { civilite: 1, nom: 'Sisavath', prenom: 'Bounmy', email: 'bounmy.sisavath@example.com' },
    ])
    .select('id')
  if (personnesErr) throw personnesErr
  const [personneSomchai, personneMarie, personneBounmy] = personnes

  const { data: participants, error: participantsErr } = await supabase
    .from('profils_participant')
    .insert([
      { organisation_id: organisationId, personne_id: personneSomchai.id },
      { organisation_id: organisationId, personne_id: personneMarie.id },
      { organisation_id: organisationId, personne_id: personneBounmy.id },
    ])
    .select('id')
  if (participantsErr) throw participantsErr
  const [participantSomchai, participantMarie, participantBounmy] = participants

  const { error: donsErr } = await supabase.from('dons').insert([
    { organisation_id: organisationId, profil_participant_id: participantSomchai.id, activite_id: activiteCeremonie.id, montant: 50, mode_paiement: 1, date: daysAgo(120) },
    { organisation_id: organisationId, profil_participant_id: participantSomchai.id, montant: 30, mode_paiement: 2, date: daysAgo(60) },
    { organisation_id: organisationId, profil_participant_id: participantMarie.id, activite_id: activiteCollecte.id, montant: 100, mode_paiement: 3, date: daysAgo(30) },
    { organisation_id: organisationId, profil_participant_id: participantMarie.id, montant: 20, mode_paiement: 1, date: daysAgo(10) },
    { organisation_id: organisationId, profil_participant_id: participantBounmy.id, activite_id: activiteCeremonie.id, montant: 75, mode_paiement: 4, date: daysAgo(120) },
  ])
  if (donsErr) throw donsErr

  const { error: adherentsErr } = await supabase.from('adherents').insert([
    { organisation_id: organisationId, civilite: 1, nom: 'Phommachanh', prenom: 'Khamla', statut: 'actif', tags: ['Bénévoles'], date_naissance: '1978-04-12' },
    { organisation_id: organisationId, civilite: 2, nom: 'Martin', prenom: 'Sophie', statut: 'actif', tags: [] },
    { organisation_id: organisationId, civilite: 1, nom: 'Vongphakdy', prenom: 'Anousone', statut: 'actif', tags: ['Conseil'], date_naissance: '1965-09-03' },
    { organisation_id: organisationId, civilite: 2, nom: 'Leclerc', prenom: 'Anne', statut: 'archive', tags: [] },
  ])
  if (adherentsErr) throw adherentsErr
}
