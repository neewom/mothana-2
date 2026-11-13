import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useReveal } from '../hooks/useReveal'
import { cheminEspaceConnecte } from '../lib/espaceUtilisateur'
import { CONTACT_EMAIL, CONTACT_MAILTO } from '../lib/contact'
import { getDemoUrl } from '../lib/environment'
import { cn } from '@/lib/utils'
import RecetteBanner from '../components/RecetteBanner'
import SiteHeader from '../components/site/SiteHeader'
import SiteFooter from '../components/site/SiteFooter'

// Captures de l'app sur des données de démonstration fictives (organisation de démo de la recette,
// noms remplacés à la capture). WebP en plusieurs largeurs pour `srcset`.
import dashboard800 from '../assets/landing/dashboard-800.webp'
import dashboard1280 from '../assets/landing/dashboard-1280.webp'
import dashboard1920 from '../assets/landing/dashboard-1920.webp'
import dashboard2880 from '../assets/landing/dashboard-2880.webp'
import dashboardMobile320 from '../assets/landing/dashboard-mobile-320.webp'
import dashboardMobile640 from '../assets/landing/dashboard-mobile-640.webp'
import dashboardMobile960 from '../assets/landing/dashboard-mobile-960.webp'
import import640 from '../assets/landing/import-640.webp'
import import1080 from '../assets/landing/import-1080.webp'
import modeleRecu640 from '../assets/landing/modele-recu-640.webp'
import modeleRecu1080 from '../assets/landing/modele-recu-1080.webp'
import equipe640 from '../assets/landing/equipe-640.webp'
import equipe1080 from '../assets/landing/equipe-1080.webp'
import benevoleMobile320 from '../assets/landing/benevole-mobile-320.webp'
import benevoleMobile640 from '../assets/landing/benevole-mobile-640.webp'
import recus640 from '../assets/landing/recus-640.webp'
import recus1080 from '../assets/landing/recus-1080.webp'
import recus1600 from '../assets/landing/recus-1600.webp'
import stats640 from '../assets/landing/statistiques-640.webp'
import stats1080 from '../assets/landing/statistiques-1080.webp'
import stats1600 from '../assets/landing/statistiques-1600.webp'

const srcSet = (variantes: Record<number, string>) =>
  Object.entries(variantes)
    .map(([largeur, src]) => `${src} ${largeur}w`)
    .join(', ')

const IMG_DASHBOARD = srcSet({ 800: dashboard800, 1280: dashboard1280, 1920: dashboard1920, 2880: dashboard2880 })
const IMG_DASHBOARD_MOBILE = srcSet({ 320: dashboardMobile320, 640: dashboardMobile640, 960: dashboardMobile960 })
const IMG_IMPORT = srcSet({ 640: import640, 1080: import1080 })
const IMG_MODELE_RECU = srcSet({ 640: modeleRecu640, 1080: modeleRecu1080 })
const IMG_EQUIPE = srcSet({ 640: equipe640, 1080: equipe1080 })
const IMG_BENEVOLE_MOBILE = srcSet({ 320: benevoleMobile320, 640: benevoleMobile640 })
const IMG_RECUS = srcSet({ 640: recus640, 1080: recus1080, 1600: recus1600 })
const IMG_STATS = srcSet({ 640: stats640, 1080: stats1080, 1600: stats1600 })

/** Apparition au défilement (voir useReveal) : départ masqué seulement si les animations sont permises. */
const REVEAL =
  'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:translate-y-6 motion-safe:opacity-0 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 focus-visible:ring-offset-2'

// ---------------------------------------------------------------------------
// Icônes (trait 1,5, même gabarit partout)

const ICONES = {
  adherents: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 19.5c.7-3.2 3.1-5 6-5s5.3 1.8 6 5" />
      <path d="M16 4.75a3.25 3.25 0 0 1 0 6.5M18.25 14.75c1.6.75 2.6 2.4 3 4.75" />
    </>
  ),
  renouvellement: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v3.75h-3.75" />
      <path d="m9 12.25 2 2 4-4.25" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5.25" width="18" height="13.5" rx="1.5" />
      <path d="m3.75 6.5 8.25 6.5 8.25-6.5" />
    </>
  ),
  courrier: (
    <>
      <path d="M6 3.75h8.5L18 7.25v13H6z" />
      <path d="M14.25 3.75v3.5H18M9 11.5h6M9 14.5h6M9 17.5h3.5" />
    </>
  ),
  statistiques: (
    <>
      <path d="M3.75 20.25h16.5" />
      <path d="M6.5 20.25v-6.5M11 20.25V5.75M15.5 20.25v-9M20 20.25v-4" />
    </>
  ),
  activites: (
    <>
      <rect x="3.75" y="5" width="16.5" height="15.25" rx="1.5" />
      <path d="M3.75 9.75h16.5M8.25 3v3.5M15.75 3v3.5" />
      <path d="M8 13.5h2.5M13.5 13.5H16M8 16.75h2.5" />
    </>
  ),
  europe: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M3.75 12h16.5M12 3.75c2.2 2.3 3.3 5 3.3 8.25s-1.1 5.95-3.3 8.25c-2.2-2.3-3.3-5-3.3-8.25S9.8 6.05 12 3.75z" />
    </>
  ),
  cloison: (
    <>
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="1.5" />
      <path d="M12 3.75v16.5M3.75 12h16.5" />
    </>
  ),
  sauvegarde: (
    <>
      <ellipse cx="12" cy="6.25" rx="7.25" ry="2.5" />
      <path d="M4.75 6.25v11.5c0 1.4 3.25 2.5 7.25 2.5s7.25-1.1 7.25-2.5V6.25" />
      <path d="M4.75 12c0 1.4 3.25 2.5 7.25 2.5s7.25-1.1 7.25-2.5" />
    </>
  ),
  cadenas: (
    <>
      <rect x="5" y="10.5" width="14" height="9.75" rx="1.5" />
      <path d="M8.25 10.5V7.75a3.75 3.75 0 0 1 7.5 0v2.75M12 14.25v2.25" />
    </>
  ),
  coche: <path d="m5.5 12.5 4.25 4.25 8.75-9.5" />,
  fleche: <path d="M5 12h13.5m-5.25-5.25L18.5 12l-5.25 5.25" />,
} as const

function Icone({ nom, className }: { nom: keyof typeof ICONES; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-6 w-6 flex-shrink-0', className)}
    >
      {ICONES[nom]}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Éléments réutilisés

/**
 * Appel principal : la démo publique (autre domaine, sans compte). Simple lien sortant, même onglet :
 * la démo est lourde (une base embarquée se charge dans le navigateur) et son « Nous contacter » ouvre
 * un email, le retour arrière ramène à la landing. Aucun préchargement : rien de la démo n'est demandé
 * avant le clic.
 */
function BoutonDemo({ className }: { className?: string }) {
  return (
    <a
      href={getDemoUrl()}
      className={cn(
        'group inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-stamp px-6 text-base font-semibold text-white transition-colors hover:bg-stamp/90',
        FOCUS,
        className,
      )}
    >
      Voir la démo
      <Icone nom="fleche" className="h-5 w-5 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
    </a>
  )
}

/** Appel secondaire : un email à la boîte de contact (pas de formulaire côté serveur). */
function BoutonContact({ className }: { className?: string }) {
  return (
    <a
      href={CONTACT_MAILTO}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-sm border border-paper-border bg-white px-6 text-base font-semibold text-ink-muted transition-colors hover:border-ink-faint hover:text-ink',
        FOCUS,
        className,
      )}
    >
      Nous contacter
    </a>
  )
}

/**
 * Les deux appels à l'action côte à côte (empilés en mobile), la démo en premier.
 * L'inscription en ligne (/inscription) n'a volontairement plus de lien public tant que l'offre n'est pas
 * prête ; pour la réactiver, voir `src/lib/essaiGratuit.ts`.
 */
function BoutonsAppel({ className }: { className?: string }) {
  return (
    <div className={cn('flex w-full flex-col gap-3 sm:w-auto sm:flex-row', className)}>
      <BoutonDemo />
      <BoutonContact />
    </div>
  )
}

/** Cadre de navigateur autour d'une capture de l'app (compact : barre réduite pour une petite vignette). */
function CadreNavigateur({ children, adresse, compact = false }: { children: ReactNode; adresse: string; compact?: boolean }) {
  const point = compact ? 'h-1.5 w-1.5 rounded-full bg-paper-border' : 'h-2 w-2 rounded-full bg-paper-border sm:h-2.5 sm:w-2.5'
  return (
    <div className="overflow-hidden rounded-sm border border-paper-border bg-white shadow-2xl shadow-ink/15">
      <div className={cn('flex items-center border-b border-paper-border bg-paper', compact ? 'h-5 gap-1 px-2' : 'h-7 gap-1.5 px-3 sm:h-8')}>
        <span className={point} />
        <span className={point} />
        <span className={point} />
        <span
          className={cn(
            'hidden rounded-sm border border-paper-border bg-white px-2 font-registre-mono text-[10px] leading-4 text-ink-faint',
            compact ? 'ml-2 lg:inline' : 'ml-3 sm:inline',
          )}
        >
          {adresse}
        </span>
      </div>
      {children}
    </div>
  )
}

/** Téléphone (illustration d'appareil, d'où l'arrondi propre). */
function Telephone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[1.6rem] bg-ink p-[5px] shadow-2xl shadow-ink/30 sm:p-[7px]', className)}>
      <div className="overflow-hidden rounded-[1.3rem] bg-white">{children}</div>
    </div>
  )
}

function TitreSection({ titre, sousTitre, className }: { titre: string; sousTitre?: string; className?: string }) {
  return (
    <div data-reveal className={cn(REVEAL, 'max-w-2xl', className)}>
      <h2 className="text-balance text-[2rem] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.75rem]">
        {titre}
      </h2>
      {sousTitre && <p className="mt-4 text-pretty text-lg leading-relaxed text-ink-muted">{sousTitre}</p>}
    </div>
  )
}

/** Tampon encré (registre « carnet tamponné »). */
function Tampon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex flex-col items-center rounded-sm border-[3px] px-3 py-1.5 text-center font-registre-mono text-[11px] font-semibold uppercase leading-tight tracking-[0.14em]',
        className,
      )}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Simple, vraiment : captures de l'app (association de démo, noms d'exemple)

type IllustrationSimpleType = 'import' | 'modele' | 'equipe'

const TAILLES_COLONNE = '(min-width: 768px) 30vw, calc(100vw - 64px)'

function IllustrationSimple({ type }: { type: IllustrationSimpleType }) {
  return (
    <div className="relative flex aspect-[4/3] items-center overflow-hidden rounded-sm bg-paper-border-muted/60 p-4">
      {type === 'import' && (
        <div className="w-full">
          <CadreNavigateur compact adresse="samakan.fr/admin">
            <img
              src={import640}
              srcSet={IMG_IMPORT}
              sizes={TAILLES_COLONNE}
              width={2208}
              height={1380}
              loading="lazy"
              decoding="async"
              alt="Import d'un fichier de donateurs : chaque colonne du fichier est associée à un champ de Samakan."
              className="block h-auto w-full"
            />
          </CadreNavigateur>
        </div>
      )}
      {type === 'modele' && (
        <div className="w-full">
          <CadreNavigateur compact adresse="samakan.fr/admin">
            <img
              src={modeleRecu640}
              srcSet={IMG_MODELE_RECU}
              sizes={TAILLES_COLONNE}
              width={2201}
              height={1190}
              loading="lazy"
              decoding="async"
              alt="Éditeur du modèle de reçu fiscal : le code du modèle à gauche, l'aperçu du reçu à droite."
              className="block h-auto w-full"
            />
          </CadreNavigateur>
        </div>
      )}
      {type === 'equipe' && (
        <>
          <div className="absolute left-4 top-6 w-[78%]">
            <CadreNavigateur compact adresse="samakan.fr/admin">
              <img
                src={equipe640}
                srcSet={IMG_EQUIPE}
                sizes="(min-width: 768px) 24vw, 72vw"
                width={1723}
                height={1077}
                loading="lazy"
                decoding="async"
                alt="Page Équipe et accès : les comptes du bureau avec leur rôle, et le code PIN des bénévoles."
                className="block h-auto w-full"
              />
            </CadreNavigateur>
          </div>
          <Telephone className="absolute right-4 top-[30%] w-[30%] rotate-2 rounded-[1.1rem] p-[3px] sm:p-[4px]">
            <img
              src={benevoleMobile320}
              srcSet={IMG_BENEVOLE_MOBILE}
              sizes="(min-width: 768px) 9vw, 28vw"
              width={1170}
              height={2532}
              loading="lazy"
              decoding="async"
              alt="Espace bénévole sur téléphone : saisie d'un don de 20 € en espèces."
              className="block h-auto w-full"
            />
          </Telephone>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contenu

const MODULES_SECONDAIRES: { icone: keyof typeof ICONES; titre: string; texte: string }[] = [
  { icone: 'adherents', titre: 'Adhérents', texte: 'Numéro automatique, carte imprimable, fiche complète.' },
  { icone: 'renouvellement', titre: 'Renouvellements', texte: 'Chaque adhérent reçoit son lien personnel pour renouveler.' },
  { icone: 'email', titre: 'Emailing', texte: 'Campagnes ciblées. Désinscriptions et adresses invalides gérées.' },
  { icone: 'courrier', titre: 'Courrier', texte: "Lettres et étiquettes pour ceux qui n'ont pas d'email." },
]

const MODULES_FIN: { icone: keyof typeof ICONES; titre: string; texte: string }[] = [
  { icone: 'statistiques', titre: 'Statistiques', texte: 'La collecte par mois, par activité, par mode de paiement.' },
  { icone: 'activites', titre: 'Activités', texte: 'Fêtes, collectes, cours : chaque don rattaché à son activité.' },
]

const INCLUS = [
  'Saisie des dons',
  'Dons réguliers',
  'Reçus fiscaux Cerfa en lot',
  'Envoi des reçus par email',
  'Fichier des adhérents',
  'Renouvellement par lien personnel',
  "Cartes d'adhérent imprimables",
  'Campagnes email',
  'Courrier et étiquettes',
  'Espace bénévole par code PIN',
  'Statistiques de collecte',
  'Import de ton fichier existant',
]

const SIMPLE: { illustration: IllustrationSimpleType; titre: string; texte: string }[] = [
  {
    illustration: 'import',
    titre: 'Tu repars de ton existant',
    texte: "Importe ton tableur de donateurs, d'adhérents et de dons. Rien à ressaisir.",
  },
  {
    illustration: 'modele',
    titre: 'À tes couleurs',
    texte: "Le logo et les couleurs de ton association, ton propre modèle de reçu fiscal.",
  },
  {
    illustration: 'equipe',
    titre: "Toute l'équipe s'y met",
    texte: 'Admins et contributeurs au bureau, bénévoles sur le terrain avec un simple code PIN.',
  },
]

const CONFIANCE: { icone: keyof typeof ICONES; titre: string; texte: string }[] = [
  {
    icone: 'europe',
    titre: 'Hébergées en Europe',
    texte:
      "Base de données et emails en Irlande, génération des reçus PDF aux Pays-Bas, campagnes d'emailing hébergées dans l'Union européenne.",
  },
  {
    icone: 'cloison',
    titre: 'Chaque association isolée',
    texte: 'Les données de chaque association sont cloisonnées directement dans la base.',
  },
  {
    icone: 'sauvegarde',
    titre: 'Sauvegardées chaque jour',
    texte: 'Une sauvegarde quotidienne de toutes les données de production.',
  },
  {
    icone: 'cadenas',
    titre: 'Connexion chiffrée',
    texte: 'HTTPS partout, avec HSTS : tes échanges avec Samakan ne circulent jamais en clair.',
  },
]

// ---------------------------------------------------------------------------
// Une année avec Samakan : vignettes

function VignetteRenouvellements() {
  return (
    <div className="rounded-sm border border-paper-border bg-white p-5">
      <div className="flex items-center justify-between font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">
        <span>Renouvellements</span>
        <span>Saison en cours</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper-border-muted">
        <div
          data-reveal
          className="h-full w-[68%] origin-left rounded-full bg-success transition-transform delay-200 duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:scale-x-0 data-[visible=true]:scale-x-100"
        />
      </div>
      <div className="mt-3 flex items-center gap-4 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" /> Renouvelés
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-paper-border" /> À relancer
        </span>
      </div>
    </div>
  )
}

function VignetteBenevole() {
  return (
    <div className="rounded-sm bg-ink p-5 text-paper">
      <p className="font-registre-mono text-[11px] uppercase tracking-wide text-paper/60">Espace bénévole</p>
      <p className="mt-3 flex items-center gap-2 text-lg font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-paper/40">
          <Icone nom="coche" className="h-4 w-4" />
        </span>
        Don enregistré
      </p>
      <p className="mt-1 font-registre-mono text-xs text-paper/70">20,00 € · Espèces · Fête de quartier</p>
    </div>
  )
}

function VignetteEmail() {
  return (
    <div className="rounded-sm border border-paper-border bg-white">
      <div className="border-b border-paper-border px-5 py-3 text-sm">
        <span className="text-ink-faint">Objet : </span>
        <span className="font-medium text-ink">Merci pour cette année</span>
      </div>
      <div className="space-y-2 px-5 py-4 text-sm text-ink-muted">
        <p>
          Bonjour <span className="rounded-sm bg-paper px-1 font-registre-mono text-xs text-ink">{'{prénom}'}</span>,
        </p>
        <p>grâce à toi, cette année…</p>
        <div className="h-2 w-4/5 rounded-full bg-paper-border-muted" />
        <div className="h-2 w-3/5 rounded-full bg-paper-border-muted" />
      </div>
    </div>
  )
}

function VignetteRecu() {
  return (
    <div className="relative rounded-sm border border-paper-border bg-white p-5">
      <p className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Reçu au titre des dons</p>
      <p className="mt-1 font-registre-mono text-xs text-ink-faint">Cerfa n° 11580</p>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-11/12 rounded-full bg-paper-border-muted" />
        <div className="h-2 w-3/4 rounded-full bg-paper-border-muted" />
        <div className="h-2 w-5/6 rounded-full bg-paper-border-muted" />
      </div>
      <Tampon className="absolute bottom-4 right-4 -rotate-6 border-ink/80 text-ink/80">Reçu émis</Tampon>
    </div>
  )
}

function VignetteStatistiques() {
  return (
    <div className="overflow-hidden rounded-sm border border-paper-border bg-white">
      <img
        src={stats640}
        srcSet={IMG_STATS}
        sizes="(min-width: 1024px) 352px, calc(100vw - 72px)"
        width={2370}
        height={1800}
        loading="lazy"
        decoding="async"
        alt="Page Statistiques de Samakan : total des dons de l'année et courbe des dons par mois comparée à l'année précédente."
        className="block h-auto w-full"
      />
    </div>
  )
}

const ANNEE: { mois: string; moment: string; titre: string; texte: string; vignette: ReactNode }[] = [
  {
    mois: 'Septembre',
    moment: 'La rentrée',
    titre: 'Chaque adhérent renouvelle en un clic',
    texte:
      "Chaque adhérent reçoit son lien personnel pour renouveler. Ceux qui n'ont pas d'email reçoivent un courrier, étiquettes prêtes à imprimer.",
    vignette: <VignetteRenouvellements />,
  },
  {
    mois: 'Octobre',
    moment: 'La grande fête',
    titre: 'Les bénévoles saisissent les dons sur place',
    texte:
      "Un code PIN, un téléphone : chaque don est enregistré dans la foulée et rattaché à l'activité. Plus de feuille volante à recopier le lendemain.",
    vignette: <VignetteBenevole />,
  },
  {
    mois: 'Décembre',
    moment: "L'appel aux dons",
    titre: 'Ta campagne email en quelques minutes',
    texte:
      'Tu écris une fois, tu choisis à qui. Les désinscriptions et les adresses invalides sont gérées pour toi.',
    vignette: <VignetteEmail />,
  },
  {
    mois: 'Janvier',
    moment: 'Les reçus fiscaux',
    titre: 'Tous les reçus Cerfa, en lot',
    texte:
      'Même pour les dons en espèces et par chèque. Générés au modèle de ton association, envoyés par email, les fiches incomplètes signalées avant.',
    vignette: <VignetteRecu />,
  },
  {
    mois: 'Printemps',
    moment: "L'assemblée générale",
    titre: "Les chiffres de l'année, prêts à présenter",
    texte:
      "La collecte mois par mois, par activité et par mode de paiement, la liste des adhérents à jour. Ton trésorier arrive serein.",
    vignette: <VignetteStatistiques />,
  },
]

// ---------------------------------------------------------------------------

export default function LandingPage() {
  const { auth } = useAuth()
  const espaceConnecte = cheminEspaceConnecte(auth.type)

  // Utilisateur connecté (ou session en cours de lecture) : rien de la landing ne s'affiche.
  if (espaceConnecte) return <Navigate to={espaceConnecte} replace />
  if (auth.type === 'loading') return <div className="min-h-dvh bg-paper" />

  return <Landing />
}

const TITRE_LANDING = 'Samakan — Toute la gestion de ton association, sans la complexité'

function Landing() {
  const racine = useRef<HTMLDivElement>(null)

  // Titre propre à la landing ; le reste de l'app garde le titre court d'index.html.
  useEffect(() => {
    const titrePrecedent = document.title
    document.title = TITRE_LANDING
    return () => { document.title = titrePrecedent }
  }, [])
  useReveal(racine)

  // Les captures du haut se « posent » à l'arrivée (inclinaison qui s'aplanit), sauf si l'utilisateur
  // a demandé de réduire les animations.
  const [posee, setPosee] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPosee(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div ref={racine} className="min-h-dvh overflow-x-clip bg-paper font-registre text-ink selection:bg-stamp/15">
      <RecetteBanner />

      {/* ------------------------------------------------------------------ Hero */}
      <div className="relative">
        <SiteHeader />

        <main>
          <section className="relative px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-paper-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink-muted">
                <Icone nom="coche" className="h-4 w-4 text-success" />
                Conçu avec et pour des associations
              </p>
              <h1 className="mt-6 text-balance text-[2.2rem] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[4.5rem]">
                Toute la gestion de ton association.{' '}
                <span className="block text-ink-muted">Sans la complexité.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-muted sm:text-xl">
                Dons, reçus fiscaux, adhésions, emailing, bénévoles : un seul outil pour le bureau et les
                bénévoles.
              </p>
              <BoutonsAppel className="mt-9" />
              <p className="mt-4 text-sm text-ink-faint">
                Culte, culture, sport, solidarité, quartier : Samakan s'adapte à ton association.
              </p>
            </div>

            <div className="relative mx-auto mt-14 max-w-6xl [perspective:2000px] sm:mt-20">
              <div
                className="transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] [transform-origin:50%_100%]"
                style={{ transform: posee ? 'rotateX(0deg) translateY(0)' : 'rotateX(16deg) translateY(2.5rem)' }}
              >
                <CadreNavigateur adresse="samakan.fr/admin">
                  <img
                    src={dashboard1280}
                    srcSet={IMG_DASHBOARD}
                    sizes="(min-width: 1200px) 1150px, calc(100vw - 32px)"
                    width={1440}
                    height={900}
                    fetchPriority="high"
                    decoding="async"
                    alt="Tableau de bord de Samakan : dons du mois et de l'année, adhésions à renouveler, dons récents et activités à venir."
                    className="block h-auto w-full"
                  />
                </CadreNavigateur>
              </div>
              <div
                className="absolute -bottom-10 right-0 w-[36%] max-w-[15rem] sm:w-[30%] transition-transform delay-150 duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:-bottom-12 sm:right-6 xl:-right-6"
                style={{ transform: posee ? 'translateY(0) rotate(2deg)' : 'translateY(4rem) rotate(6deg)' }}
              >
                <Telephone>
                  <img
                    src={dashboardMobile640}
                    srcSet={IMG_DASHBOARD_MOBILE}
                    sizes="(min-width: 1024px) 240px, 36vw"
                    width={1170}
                    height={2532}
                    decoding="async"
                    alt="Le même tableau de bord de Samakan sur téléphone."
                    className="block h-auto w-full"
                  />
                </Telephone>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------- Mosaïque */}
          <section id="modules" className="scroll-mt-6 px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-6xl">
              <TitreSection
                titre="Tout ce que fait ton association, au même endroit."
                sousTitre="Les dons, les adhérents, la communication et le terrain partagent enfin les mêmes données."
              />

              <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-4">
                {/* Grande tuile : dons et reçus */}
                <article
                  data-reveal
                  className={cn(
                    REVEAL,
                    'relative col-span-2 flex flex-col overflow-hidden rounded-sm bg-ink text-paper lg:row-span-2',
                  )}
                >
                  <div className="p-6 sm:p-8">
                    <h3 className="text-balance text-[1.75rem] font-bold leading-[1.1] tracking-[-0.025em] sm:text-[2.1rem]">
                      Un don saisi. Un reçu Cerfa prêt.
                    </h3>
                    <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-paper/75">
                      Espèces, chèque, virement, prélèvement : chaque don, même reçu hors ligne, a droit à son reçu
                      fiscal, généré à ton modèle et envoyé par email en lot.
                    </p>
                    <p className="mt-5 font-registre-mono text-xs text-paper/60">Dons réguliers · Reçus en lot · Ton modèle</p>
                  </div>
                  <div className="relative mt-auto pl-6 sm:pl-8">
                    <div className="overflow-hidden rounded-tl-sm border-l border-t border-paper/15">
                      <img
                        src={recus640}
                        srcSet={IMG_RECUS}
                        sizes="(min-width: 1024px) 560px, calc(100vw - 56px)"
                        width={2370}
                        height={1500}
                        loading="lazy"
                        decoding="async"
                        alt="Page Reçus fiscaux de Samakan : donateurs de l'année, numéro de reçu, statut de génération et d'envoi."
                        className="block h-auto w-[135%] max-w-none sm:w-full sm:max-w-full"
                      />
                    </div>
                    <span
                      data-reveal
                      className="absolute right-4 top-4 rotate-[-8deg] transition-[opacity,transform] delay-500 duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:scale-[1.6] motion-safe:opacity-0 data-[visible=true]:scale-100 data-[visible=true]:opacity-100 sm:right-8 sm:top-8"
                    >
                      <Tampon className="border-ink bg-white/90 text-ink shadow-lg shadow-ink/30 sm:text-xs">
                        <span>Reçu fiscal</span>
                        <span className="text-[10px] font-medium tracking-[0.1em]">Émis · envoyé</span>
                      </Tampon>
                    </span>
                  </div>
                </article>

                {MODULES_SECONDAIRES.map((m, i) => (
                  <TuileModule key={m.titre} {...m} delai={i * 70} />
                ))}

                {/* Espace bénévole */}
                <article
                  data-reveal
                  className={cn(
                    REVEAL,
                    'col-span-2 flex items-center gap-5 overflow-hidden rounded-sm border border-paper-border bg-white p-5 sm:gap-8 sm:p-7',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold tracking-[-0.015em] text-ink sm:text-[1.4rem]">Le terrain, dans la poche</h3>
                    <p className="mt-2 text-pretty text-sm leading-relaxed text-ink-muted sm:text-[15px]">
                      Un code PIN et un téléphone : saisir un don, ajouter un donateur ou vérifier une adhésion
                      pendant l'événement.
                    </p>
                  </div>
                  <Telephone className="w-[6.5rem] flex-shrink-0 rotate-3 sm:w-[7.5rem]">
                    <div className="flex aspect-[9/16] flex-col items-center justify-center gap-3 px-2">
                      <span className="font-registre-mono text-[9px] uppercase tracking-wide text-ink-faint">Code PIN</span>
                      <span className="flex gap-1.5" aria-hidden="true">
                        {[0, 1, 2, 3].map((n) => (
                          <span key={n} className="h-2.5 w-2.5 rounded-full bg-ink" />
                        ))}
                      </span>
                      <span className="grid grid-cols-3 gap-1" aria-hidden="true">
                        {Array.from({ length: 9 }, (_, n) => (
                          <span key={n} className="h-3.5 w-3.5 rounded-full border border-paper-border bg-paper" />
                        ))}
                      </span>
                    </div>
                  </Telephone>
                </article>

                {MODULES_FIN.map((m, i) => (
                  <TuileModule key={m.titre} {...m} delai={i * 70} />
                ))}
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------- Une année */}
          <section id="annee" className="border-y border-paper-border bg-white px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-6xl">
              <TitreSection
                titre="Une année avec Samakan"
                sousTitre="De la rentrée à l'assemblée générale, chaque temps fort de ta saison a son outil."
              />
              <div className="relative mt-12 sm:mt-16">
                <div
                  aria-hidden="true"
                  data-reveal
                  className="absolute bottom-6 left-[7px] top-2 w-px origin-top bg-paper-border transition-transform duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:scale-y-0 data-[visible=true]:scale-y-100 lg:left-[11.5rem]"
                />
                <ol className="space-y-12 lg:space-y-0">
                  {ANNEE.map((etape) => (
                    <li
                      key={etape.mois}
                      data-reveal
                      className={cn(
                        REVEAL,
                        'relative grid gap-4 pl-9 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:gap-x-8 lg:grid-cols-[11.5rem_minmax(0,1fr)_minmax(0,22rem)] lg:gap-10 lg:border-t lg:border-paper-border-muted lg:py-10 lg:pl-0 lg:first:border-t-0',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 border-ink bg-white lg:left-[calc(11.5rem-7px)] lg:top-11"
                      />
                      <div className="md:col-span-2 lg:col-span-1 lg:pr-8">
                        <p className="font-registre-mono text-xs font-medium uppercase tracking-[0.14em] text-ink">{etape.mois}</p>
                        <p className="mt-1 text-sm text-ink-faint">{etape.moment}</p>
                      </div>
                      <div className="lg:pl-6">
                        <h3 className="text-balance text-xl font-bold leading-snug tracking-[-0.015em] text-ink sm:text-2xl">
                          {etape.titre}
                        </h3>
                        <p className="mt-3 max-w-[34rem] text-pretty text-[15px] leading-relaxed text-ink-muted">{etape.texte}</p>
                      </div>
                      <div className="mt-1 lg:mt-0">{etape.vignette}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------- Tout ce que contient Samakan */}
          <section id="inclus" className="px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
              <TitreSection
                titre="Tout ce que contient Samakan."
                sousTitre="Ce que ton association gérait entre tableurs, cahiers et boîtes mail, réuni dans un seul outil."
              />
              <ul
                data-reveal
                className={cn(
                  REVEAL,
                  'grid rounded-sm border border-paper-border bg-white sm:grid-cols-2',
                )}
              >
                {INCLUS.map((ligne) => (
                  <li
                    key={ligne}
                    className="flex items-center gap-3 border-b border-paper-border-muted px-5 py-3.5 text-[15px] text-ink sm:[&:nth-last-child(-n+2)]:border-b-0 sm:odd:border-r [&:last-child]:border-b-0"
                  >
                    <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm border border-ink/70 text-ink">
                      <Icone nom="coche" className="h-3.5 w-3.5" />
                    </span>
                    {ligne}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* -------------------------------------------------------- Simple, vraiment */}
          <section className="px-4 pb-16 sm:px-6 sm:pb-24">
            <div className="mx-auto max-w-6xl">
              <TitreSection titre="Simple, vraiment." />
              <div className="mt-10 grid gap-10 sm:mt-12 md:grid-cols-3 md:gap-8">
                {SIMPLE.map((s, i) => (
                  <div
                    key={s.titre}
                    data-reveal
                    style={{ transitionDelay: `${i * 90}ms` }}
                    className={REVEAL}
                  >
                    <IllustrationSimple type={s.illustration} />
                    <h3 className="mt-6 text-lg font-bold tracking-[-0.01em] text-ink">{s.titre}</h3>
                    <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-muted">{s.texte}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------- Confiance */}
          <section className="border-y border-paper-border bg-white px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-6xl">
              <TitreSection
                titre="Tes données sont hébergées en Europe."
                sousTitre="Les fichiers de tes donateurs et de tes adhérents méritent le même soin que ta comptabilité."
              />
              <div className="mt-10 grid gap-px overflow-hidden rounded-sm border border-paper-border bg-paper-border sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
                {CONFIANCE.map((c, i) => (
                  <div
                    key={c.titre}
                    data-reveal
                    style={{ transitionDelay: `${i * 80}ms` }}
                    className={cn(REVEAL, 'bg-white p-6')}
                  >
                    <Icone nom={c.icone} className="text-ink" />
                    <h3 className="mt-4 font-semibold text-ink">{c.titre}</h3>
                    <p className="mt-2 text-pretty text-sm leading-relaxed text-ink-muted">{c.texte}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-ink-faint">Pensé pour le RGPD dès sa conception.</p>
            </div>
          </section>

          {/* -------------------------------------------------------- Appel final */}
          {/* Appel final provisoire, autour de la démo : l'offre (essai gratuit, abonnements) n'y figure pas tant
              qu'elle n'est pas prête. Réactivation de l'essai : voir `src/lib/essaiGratuit.ts`. */}
          <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
            <div data-reveal className={cn(REVEAL, 'relative mx-auto flex max-w-3xl flex-col items-center text-center')}>
              <h2 className="text-balance text-[2.25rem] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[3.5rem]">
                Ta prochaine saison associative commence ici.
              </h2>
              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-ink-muted">
                Parcours la démo en quelques minutes, sans créer de compte. Une question sur ton association ?
                Écris-nous à <span className="whitespace-nowrap font-medium text-ink">{CONTACT_EMAIL}</span>.
              </p>
              <BoutonsAppel className="mt-9" />
            </div>
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}

function TuileModule({
  icone,
  titre,
  texte,
  delai,
}: {
  icone: keyof typeof ICONES
  titre: string
  texte: string
  delai: number
}) {
  return (
    <article
      data-reveal
      style={{ transitionDelay: `${delai}ms` }}
      className={cn(REVEAL, 'flex flex-col rounded-sm border border-paper-border bg-white p-4 sm:p-6')}
    >
      <Icone nom={icone} className="h-6 w-6 text-ink sm:h-7 sm:w-7" />
      <h3 className="mt-3 font-bold tracking-[-0.01em] text-ink sm:mt-4 sm:text-lg">{titre}</h3>
      <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-ink-muted sm:text-sm">{texte}</p>
    </article>
  )
}
