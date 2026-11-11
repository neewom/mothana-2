import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import FeatureGuard from './components/FeatureGuard'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import MentionsLegalesPage from './pages/legal/MentionsLegalesPage'
import ConfidentialitePage from './pages/legal/ConfidentialitePage'
import CguPage from './pages/legal/CguPage'
import LegacyRedirect from './components/LegacyRedirect'
import NotFoundPage from './pages/NotFoundPage'
import PageLoader from './components/PageLoader'
import { lazyWithReload } from './lib/lazyWithReload'

// Pages différées (un fichier JS par page, chargé à la première visite) : voir lazyWithReload.
const ResetPasswordPage = lazyWithReload(() => import('./pages/ResetPasswordPage'))
const BenevoleLoginPage = lazyWithReload(() => import('./pages/BenevoleLoginPage'))
const VendeurLoginPage = lazyWithReload(() => import('./pages/VendeurLoginPage'))
const RenouvellementAdhesionPage = lazyWithReload(() => import('./pages/RenouvellementAdhesionPage'))
const DesinscriptionMailingPage = lazyWithReload(() => import('./pages/DesinscriptionMailingPage'))
const AidePage = lazyWithReload(() => import('./pages/AidePage'))
const PortefeuillePage = lazyWithReload(() => import('./pages/PortefeuillePage'))
const EvenementAchatPage = lazyWithReload(() => import('./pages/EvenementAchatPage'))
const AdminLayout = lazyWithReload(() => import('./pages/AdminLayout'))
const BenevolePage = lazyWithReload(() => import('./pages/BenevolePage'))
const VendeurPage = lazyWithReload(() => import('./pages/VendeurPage'))
const DashboardPage = lazyWithReload(() => import('./pages/DashboardPage'))
const DonsPage = lazyWithReload(() => import('./pages/DonsPage'))
const DonsReguliersPage = lazyWithReload(() => import('./pages/DonsReguliersPage'))
const ParticipantsPage = lazyWithReload(() => import('./pages/ParticipantsPage'))
const ActivitesPage = lazyWithReload(() => import('./pages/ActivitesPage'))
const EvenementsPage = lazyWithReload(() => import('./pages/EvenementsPage'))
const EvenementDetailPage = lazyWithReload(() => import('./pages/EvenementDetailPage'))
const RecusFiscauxPage = lazyWithReload(() => import('./pages/RecusFiscauxPage'))
const AdherentsPage = lazyWithReload(() => import('./pages/AdherentsPage'))
const DemandesAdhesionPage = lazyWithReload(() => import('./pages/DemandesAdhesionPage'))
const CampagneMailingPage = lazyWithReload(() => import('./pages/CampagneMailingPage'))
const CampagneCourrierPage = lazyWithReload(() => import('./pages/CampagneCourrierPage'))
const ComptabilitePage = lazyWithReload(() => import('./pages/ComptabilitePage'))
const ParametresOrganisationPage = lazyWithReload(() => import('./pages/ParametresOrganisationPage'))
const ParametresRecusFiscauxPage = lazyWithReload(() => import('./pages/ParametresRecusFiscauxPage'))
const ParametresAdhesionsPage = lazyWithReload(() => import('./pages/ParametresAdhesionsPage'))
const ParametresJournalPage = lazyWithReload(() => import('./pages/ParametresJournalPage'))
const ParametresPorteMonnaiePage = lazyWithReload(() => import('./pages/ParametresPorteMonnaiePage'))
const ParametresEquipePage = lazyWithReload(() => import('./pages/ParametresEquipePage'))
const ParametresIntegrationsPage = lazyWithReload(() => import('./pages/ParametresIntegrationsPage'))
const ParametresCompteAdminPage = lazyWithReload(() => import('./pages/ParametresCompteAdminPage'))
const SuperAdminLayout = lazyWithReload(() => import('./pages/SuperAdminLayout'))
const SuperAdminPage = lazyWithReload(() => import('./pages/SuperAdminPage'))

function App() {
  return (
    <AuthProvider>
      {/* Pages différées : la landing, la connexion, les pages légales et la page introuvable
          restent dans le bundle d'entrée ; les layouts protégés ont leur propre Suspense autour
          de l'Outlet pour garder la navigation affichée pendant le chargement d'une page. */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          {/* Landing page publique (un utilisateur connecté est renvoyé vers son espace). */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mot-de-passe/nouveau" element={<ResetPasswordPage />} />
          <Route path="/login/benevole" element={<BenevoleLoginPage />} />
          <Route path="/login/vendeur" element={<VendeurLoginPage />} />
          {/* /adhesion/<slug> seul (ancien formulaire public, retiré) : aucune route, traité par la page introuvable. */}
          <Route path="/adhesion/:slug/renouveler" element={<RenouvellementAdhesionPage />} />
          <Route path="/desinscription" element={<DesinscriptionMailingPage />} />
          {/* Ancienne page de présentation, remplacée par la landing. */}
          <Route path="/decouvrir" element={<Navigate to="/" replace />} />
          {/* Pages légales (gabarits à compléter, voir pages/legal/pagesLegales.ts). */}
          <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
          <Route path="/confidentialite" element={<ConfidentialitePage />} />
          <Route path="/cgu" element={<CguPage />} />
          <Route path="/aide" element={<AidePage />} />
          <Route path="/p" element={<PortefeuillePage />} />
          <Route path="/e/:organisationSlug/:evenementSlug" element={<EvenementAchatPage />} />
          {/* Admin (protected) */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route element={<FeatureGuard feature="dons" />}>
                <Route path="dons" element={<DonsPage />} />
                <Route path="dons-reguliers" element={<DonsReguliersPage />} />
                <Route path="participants" element={<ParticipantsPage />} />
                <Route path="recus" element={<RecusFiscauxPage />} />
                <Route path="statistiques" element={<ComptabilitePage />} />
                <Route path="dons/parametres" element={<ParametresRecusFiscauxPage />} />
              </Route>
              <Route element={<FeatureGuard feature="adherents" />}>
                <Route path="adherents" element={<AdherentsPage />} />
                <Route path="adherents/renouvellements" element={<DemandesAdhesionPage />} />
                <Route path="communication/emailing" element={<CampagneMailingPage />} />
                <Route path="communication/courrier" element={<CampagneCourrierPage />} />
                <Route path="adherents/parametres" element={<ParametresAdhesionsPage />} />
              </Route>
              <Route element={<FeatureGuard feature={['dons', 'adherents']} />}>
                {/* Brevo sert l'emailing (Adhérents) et l'envoi des reçus fiscaux (Dons). */}
                <Route path="parametres/integrations" element={<ParametresIntegrationsPage />} />
                <Route path="activites" element={<ActivitesPage />} />
              </Route>
              <Route element={<FeatureGuard feature="evenements" />}>
                <Route path="activites/porte-monnaie" element={<EvenementsPage />} />
                <Route path="activites/porte-monnaie/:id" element={<EvenementDetailPage />} />
                <Route path="activites/parametres" element={<ParametresPorteMonnaiePage />} />
              </Route>
              {/* Anciennes adresses (réorganisation du menu, 2026-10) : redirigées vers les nouvelles,
                  hors FeatureGuard — la page cible applique sa propre garde de module. */}
              <Route path="comptabilite" element={<LegacyRedirect to="/admin/statistiques" />} />
              <Route path="adherents/campagne-mailing" element={<LegacyRedirect to="/admin/communication/emailing" />} />
              <Route path="adherents/campagne-courrier" element={<LegacyRedirect to="/admin/communication/courrier" />} />
              <Route path="evenements" element={<LegacyRedirect to="/admin/activites/porte-monnaie" />} />
              <Route path="evenements/:id" element={<LegacyRedirect to="/admin/activites/porte-monnaie/:id" />} />
              <Route path="parametres/fiscal" element={<LegacyRedirect to="/admin/dons/parametres" />} />
              <Route path="parametres/adherents" element={<LegacyRedirect to="/admin/adherents/parametres" />} />
              <Route path="parametres/suivi" element={<LegacyRedirect to="/admin/adherents/journal" />} />
              {/* Réglages rangés dans leur module (2026-11-08). */}
              <Route path="parametres/recus-fiscaux" element={<LegacyRedirect to="/admin/dons/parametres" />} />
              <Route path="parametres/adhesions" element={<LegacyRedirect to="/admin/adherents/parametres" />} />
              <Route path="parametres/porte-monnaie" element={<LegacyRedirect to="/admin/activites/parametres" />} />
              <Route path="parametres/journal" element={<LegacyRedirect to="/admin/adherents/journal" />} />
              {/* « Demandes » devient « Renouvellements » (2026-11-09). */}
              <Route path="adherents/demandes" element={<LegacyRedirect to="/admin/adherents/renouvellements" />} />
              <Route path="parametres" element={<ParametresOrganisationPage />} />
              <Route path="parametres/equipe" element={<ParametresEquipePage />} />
              {/* Codes PIN fusionnés dans Équipe et accès (2026-11-09). */}
              <Route path="parametres/codes-pin" element={<LegacyRedirect to="/admin/parametres/equipe#codes-pin" />} />
              {/* Journal des adhérents : rangé sous Adhérents, sans garde de module comme avant. */}
              <Route path="adherents/journal" element={<ParametresJournalPage />} />
              <Route path="parametres/compte" element={<ParametresCompteAdminPage />} />
            </Route>
          </Route>

          {/* Super-admin (protected) */}
          <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
            <Route path="/super-admin" element={<SuperAdminLayout />}>
              <Route index element={<SuperAdminPage />} />
            </Route>
          </Route>

          {/* Benevole (protected) */}
          <Route element={<ProtectedRoute allowedRoles={['benevole']} />}>
            <Route path="/benevole" element={<BenevolePage />} />
          </Route>

          {/* Vendeur événement (protected) */}
          <Route element={<ProtectedRoute allowedRoles={['vendeur']} />}>
            <Route path="/vendeur" element={<VendeurPage />} />
          </Route>

          {/* Toute adresse inconnue (publique, hors zones protégées) : page introuvable. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
