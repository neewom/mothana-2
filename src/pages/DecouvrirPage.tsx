import imgDashboard from '../assets/decouvrir/01-dashboard.png'
import imgDonModal from '../assets/decouvrir/10-don-modal.png'
import imgDonsListe from '../assets/decouvrir/02-dons-liste.png'
import imgRecusFiscaux from '../assets/decouvrir/04-recus-fiscaux.png'
import imgComptabilite from '../assets/decouvrir/03-comptabilite.png'
import imgFormulairePublic from '../assets/decouvrir/13-formulaire-adhesion-public.png'
import imgDemandesAdhesion from '../assets/decouvrir/06-demandes-adhesion.png'
import imgAdherentsListe from '../assets/decouvrir/05-adherents-liste.png'
import imgCarteAdherent from '../assets/decouvrir/11-carte-adherent-preview.png'
import imgMailing from '../assets/decouvrir/07-mailing.png'
import imgBenevoleLogin from '../assets/decouvrir/14-benevole-login.png'
import imgBenevoleDon from '../assets/decouvrir/15-benevole-don.png'
import imgBenevoleVerification from '../assets/decouvrir/16-benevole-verification.png'
import imgParametresOrganisation from '../assets/decouvrir/08-parametres-organisation.png'
import imgFormulaireEditor from '../assets/decouvrir/12-formulaire-adhesion-editor.png'
import { Button } from '../components/ui/button'

const SECTIONS = [
  { id: 'dons', label: 'Dons' },
  { id: 'adherents', label: 'Adhérents' },
  { id: 'mailing', label: 'Mailing' },
  { id: 'benevole', label: 'Espace bénévole' },
  { id: 'personnalisation', label: 'Personnalisation' },
]

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-sm border border-paper-border bg-white">
      <div className="flex h-8 items-center gap-1.5 border-b border-paper-border bg-paper px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-paper-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper-border" />
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  )
}

function Feature({
  title,
  description,
  image,
  imageAlt,
  reverse = false,
  mobile = false,
}: {
  title: string
  description: string
  image: string
  imageAlt: string
  reverse?: boolean
  mobile?: boolean
}) {
  return (
    <div className="grid items-center gap-8 py-10 lg:grid-cols-5 lg:gap-12">
      <div className={`lg:col-span-2 ${reverse ? 'lg:order-2' : ''}`}>
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
      <div className={`lg:col-span-3 ${reverse ? 'lg:order-1' : ''} ${mobile ? 'flex justify-center' : ''}`}>
        <div className={mobile ? 'w-full max-w-[280px]' : 'w-full'}>
          <BrowserFrame src={image} alt={imageAlt} />
        </div>
      </div>
    </div>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-stamp">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-ink-muted">{description}</p>
    </div>
  )
}

export default function DecouvrirPage() {
  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-dvh bg-paper font-registre">
      {/* Hero */}
      <header className="bg-ink px-6 pb-20 pt-16 text-paper sm:pt-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-paper/60">Présentation</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Samakan</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-paper/70">
            La plateforme de gestion des dons et des adhésions pensée pour les associations —
            dons, adhérents, reçus fiscaux Cerfa, campagnes email et espace bénévole terrain,
            réunis dans un seul outil.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href="#dons"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('dons')
              }}
              className="rounded-sm bg-stamp px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stamp/90"
            >
              Découvrir les fonctionnalités
            </a>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-5xl">
          <BrowserFrame src={imgDashboard} alt="Tableau de bord Samakan" />
        </div>
      </header>

      {/* Mobile sticky nav */}
      <div className="sticky top-0 z-30 border-b border-paper-border bg-white/95 backdrop-blur lg:hidden">
        <nav className="flex gap-4 overflow-x-auto px-4 py-3 text-sm font-medium text-ink-muted">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className="shrink-0 whitespace-nowrap rounded-sm px-2 py-1 hover:bg-paper hover:text-ink"
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto flex max-w-7xl gap-10 px-6 py-12">
        {/* Desktop sticky sidebar nav */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-12 space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="block w-full rounded-sm px-3 py-2 text-left text-sm font-medium text-ink-muted transition-colors hover:bg-paper hover:text-ink"
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          <section id="dons" className="scroll-mt-20 border-b border-paper-border pb-4">
            <SectionHeading
              eyebrow="Dons"
              title="De la saisie au reçu fiscal, sans ressaisie"
              description="Chaque don est enregistré une seule fois — l'association garde une vue d'ensemble claire et peut générer les reçus fiscaux Cerfa correspondants en un clic."
            />
            <Feature
              title="Saisir un don en quelques secondes"
              description="Un formulaire simple pour enregistrer un don : participant, activité, montant et mode de paiement. Le participant peut être retrouvé instantanément ou créé à la volée."
              image={imgDonModal}
              imageAlt="Formulaire d'ajout d'un don"
            />
            <Feature
              reverse
              title="Suivre tous les dons au même endroit"
              description="Liste complète des dons avec filtres par période, participant, activité ou mode de paiement, et des indicateurs clés (total collecté, don moyen, participants distincts) toujours visibles."
              image={imgDonsListe}
              imageAlt="Liste des dons avec indicateurs"
            />
            <Feature
              title="Reçus fiscaux Cerfa en un clic"
              description="Génération automatique des reçus fiscaux (Cerfa 11580/16216) à partir des dons de l'année, avec détection des dossiers incomplets avant génération."
              image={imgRecusFiscaux}
              imageAlt="Liste des reçus fiscaux à générer"
            />
            <Feature
              reverse
              title="Un tableau de bord comptable clair"
              description="Évolution des dons mois par mois, répartition par activité et par mode de paiement — de quoi préparer sereinement une réunion de bureau ou un point avec le trésorier."
              image={imgComptabilite}
              imageAlt="Tableau de bord comptable"
            />
          </section>

          <section id="adherents" className="scroll-mt-20 border-b border-paper-border py-4">
            <SectionHeading
              eyebrow="Adhérents"
              title="De la demande en ligne à la carte imprimée"
              description="Les futurs adhérents font leur demande en ligne, le bureau ratifie en un geste, et les cartes adhérent personnalisées s'impriment à l'unité ou en masse, à l'image de l'association."
            />
            <Feature
              title="Un formulaire d'adhésion en ligne"
              description="Vos futurs adhérents remplissent une demande depuis une page publique à votre image, avec signature électronique et acceptation des statuts."
              image={imgFormulairePublic}
              imageAlt="Formulaire public de demande d'adhésion"
            />
            <Feature
              reverse
              title="Ratifier les demandes en un geste"
              description="Le bureau retrouve toutes les demandes en attente, consulte le détail, et ratifie ou refuse (avec motif) sans ressaisir la moindre information."
              image={imgDemandesAdhesion}
              imageAlt="Liste des demandes d'adhésion en attente"
            />
            <Feature
              title="Toute la base adhérents, organisée"
              description="Recherche instantanée par nom, prénom ou email, statut d'adhésion à jour et actions courantes (renouveler, archiver, imprimer la carte) directement depuis la liste."
              image={imgAdherentsListe}
              imageAlt="Liste des adhérents"
            />
            <Feature
              reverse
              title="Des cartes adhérent prêtes à imprimer"
              description="Un gabarit personnalisable par organisation, imprimable à l'unité ou en planche A4 pour plusieurs adhérents à la fois."
              image={imgCarteAdherent}
              imageAlt="Aperçu d'une carte adhérent"
            />
          </section>

          <section id="mailing" className="scroll-mt-20 border-b border-paper-border py-4">
            <SectionHeading
              eyebrow="Mailing"
              title="Des campagnes email en quelques minutes"
              description="Composez un message une fois, filtrez vos destinataires, et envoyez à tous vos adhérents via votre propre compte Brevo — avec gestion automatique de la désinscription."
            />
            <Feature
              title="Composer et envoyer une campagne"
              description="Un éditeur simple (mise en forme, liens, placeholders personnalisés) et un aperçu du nombre de destinataires avant l'envoi, filtré par statut d'adhésion."
              image={imgMailing}
              imageAlt="Composition d'une campagne mailing"
            />
          </section>

          <section id="benevole" className="scroll-mt-20 border-b border-paper-border py-4">
            <SectionHeading
              eyebrow="Espace bénévole"
              title="Un outil pensé pour le terrain"
              description="Sur un téléphone ou une tablette, pendant un événement, les bénévoles accèdent en quelques secondes à l'essentiel — sans compte individuel à gérer."
            />
            <Feature
              mobile
              title="Un accès simple et sécurisé"
              description="Un code PIN unique, partagé entre les bénévoles de l'organisation, suffit à ouvrir l'espace terrain — pas de mot de passe à retenir."
              image={imgBenevoleLogin}
              imageAlt="Écran de connexion bénévole par code PIN"
            />
            <Feature
              mobile
              reverse
              title="Enregistrer un don en direct"
              description="Le même formulaire de saisie qu'en administration, simplifié pour un usage rapide sur le terrain, pendant un événement."
              image={imgBenevoleDon}
              imageAlt="Saisie d'un don depuis l'espace bénévole"
            />
            <Feature
              mobile
              title="Vérifier un adhérent en quelques secondes"
              description="Recherche par nom et prénom pour confirmer qu'une personne est bien adhérente et à jour de cotisation — sans jamais exposer ses coordonnées au bénévole."
              image={imgBenevoleVerification}
              imageAlt="Vérification d'un adhérent par nom et prénom"
            />
          </section>

          <section id="personnalisation" className="scroll-mt-20 py-4">
            <SectionHeading
              eyebrow="Personnalisation"
              title="Une plateforme, l'identité de chaque association"
              description="Logo, coordonnées, mentions légales et parcours publics s'adaptent à chaque organisation — plusieurs associations peuvent utiliser Samakan en toute indépendance."
            />
            <Feature
              title="Votre identité, à chaque étape"
              description="Logo, informations légales (RNA, SIREN), signature du président et code d'accès bénévole se configurent depuis un seul endroit et se retrouvent automatiquement sur les reçus et cartes générés."
              image={imgParametresOrganisation}
              imageAlt="Page de paramètres de l'organisation"
            />
            <Feature
              reverse
              title="Un formulaire à vos couleurs"
              description="En-tête et pied de page du formulaire d'adhésion personnalisables en HTML/CSS, avec aperçu en direct — le cœur du formulaire reste garanti conforme."
              image={imgFormulaireEditor}
              imageAlt="Éditeur d'en-tête et pied de page du formulaire d'adhésion"
            />
          </section>

          <footer className="mt-8 rounded-sm border border-paper-border bg-white p-10 text-center">
            <h2 className="text-2xl font-bold text-ink">Envie d'en discuter ?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Sécurité des données et confidentialité par organisation sont assurées au niveau de la
              base de données elle-même, pas seulement dans l'interface.
            </p>
            <Button asChild className="mt-6">
              <a href="mailto:contact@samakan.fr">Nous contacter</a>
            </Button>
          </footer>
        </main>
      </div>
    </div>
  )
}
