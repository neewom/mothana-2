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
      { organisation_id: organisationId, nom: 'Assemblée générale annuelle', date_debut: daysAgo(120) },
      { organisation_id: organisationId, nom: 'Collecte de dons trimestrielle', date_debut: daysAgo(30) },
    ])
    .select('id')
  if (activitesErr) throw activitesErr
  const [activiteAssemblee, activiteCollecte] = activites

  const { data: personnes, error: personnesErr } = await supabase
    .from('personnes')
    .insert([
      { civilite: 1, nom: 'Bernard', prenom: 'Jean', email: 'jean.bernard@example.com', telephone: '0612345678' },
      { civilite: 2, nom: 'Dubois', prenom: 'Marie', email: 'marie.dubois@example.com' },
      { civilite: 1, nom: 'Petit', prenom: 'Marc', email: 'marc.petit@example.com' },
    ])
    .select('id')
  if (personnesErr) throw personnesErr
  const [personneJean, personneMarie, personneMarc] = personnes

  const { data: participants, error: participantsErr } = await supabase
    .from('profils_participant')
    .insert([
      { organisation_id: organisationId, personne_id: personneJean.id },
      { organisation_id: organisationId, personne_id: personneMarie.id },
      { organisation_id: organisationId, personne_id: personneMarc.id },
    ])
    .select('id')
  if (participantsErr) throw participantsErr
  const [participantJean, participantMarie, participantMarc] = participants

  const { error: donsErr } = await supabase.from('dons').insert([
    { organisation_id: organisationId, profil_participant_id: participantJean.id, activite_id: activiteAssemblee.id, montant: 50, mode_paiement: 1, date: daysAgo(120) },
    { organisation_id: organisationId, profil_participant_id: participantJean.id, montant: 30, mode_paiement: 2, date: daysAgo(60) },
    { organisation_id: organisationId, profil_participant_id: participantMarie.id, activite_id: activiteCollecte.id, montant: 100, mode_paiement: 3, date: daysAgo(30) },
    { organisation_id: organisationId, profil_participant_id: participantMarie.id, montant: 20, mode_paiement: 1, date: daysAgo(10) },
    { organisation_id: organisationId, profil_participant_id: participantMarc.id, activite_id: activiteAssemblee.id, montant: 75, mode_paiement: 4, date: daysAgo(120) },
  ])
  if (donsErr) throw donsErr

  const { error: adherentsErr } = await supabase.from('adherents').insert([
    { organisation_id: organisationId, civilite: 1, nom: 'Lefebvre', prenom: 'Thomas', statut: 'actif', tags: ['Bénévoles'], date_naissance: '1978-04-12' },
    { organisation_id: organisationId, civilite: 2, nom: 'Martin', prenom: 'Sophie', statut: 'actif', tags: [] },
    { organisation_id: organisationId, civilite: 1, nom: 'Moreau', prenom: 'Michel', statut: 'actif', tags: ['Conseil'], date_naissance: '1965-09-03' },
    { organisation_id: organisationId, civilite: 2, nom: 'Leclerc', prenom: 'Anne', statut: 'archive', tags: [] },
  ])
  if (adherentsErr) throw adherentsErr
}
