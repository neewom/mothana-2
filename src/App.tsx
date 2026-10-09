import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import FeatureGuard from './components/FeatureGuard'

import HomePage from './pages/HomePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import BenevoleLoginPage from './pages/BenevoleLoginPage'
import VendeurLoginPage from './pages/VendeurLoginPage'
import DemandeAdhesionPage from './pages/DemandeAdhesionPage'
import DesinscriptionMailingPage from './pages/DesinscriptionMailingPage'
import DecouvrirPage from './pages/DecouvrirPage'
import AidePage from './pages/AidePage'
import PortefeuillePage from './pages/PortefeuillePage'
import EvenementAchatPage from './pages/EvenementAchatPage'
import AdminLayout from './pages/AdminLayout'
import BenevolePage from './pages/BenevolePage'
import VendeurPage from './pages/VendeurPage'
import DashboardPage from './pages/DashboardPage'
import DonsPage from './pages/DonsPage'
import DonsReguliersPage from './pages/DonsReguliersPage'
import ParticipantsPage from './pages/ParticipantsPage'
import ActivitesPage from './pages/ActivitesPage'
import EvenementsPage from './pages/EvenementsPage'
import EvenementDetailPage from './pages/EvenementDetailPage'
import RecusFiscauxPage from './pages/RecusFiscauxPage'
import AdherentsPage from './pages/AdherentsPage'
import DemandesAdhesionPage from './pages/DemandesAdhesionPage'
import CampagneMailingPage from './pages/CampagneMailingPage'
import CampagneCourrierPage from './pages/CampagneCourrierPage'
import ComptabilitePage from './pages/ComptabilitePage'
import ParametresOrganisationPage from './pages/ParametresOrganisationPage'
import ParametresRecusFiscauxPage from './pages/ParametresRecusFiscauxPage'
import ParametresAdhesionsPage from './pages/ParametresAdhesionsPage'
import ParametresJournalPage from './pages/ParametresJournalPage'
import ParametresPorteMonnaiePage from './pages/ParametresPorteMonnaiePage'
import ParametresEquipePage from './pages/ParametresEquipePage'
import ParametresCodesPinPage from './pages/ParametresCodesPinPage'
import ParametresIntegrationsPage from './pages/ParametresIntegrationsPage'
import ParametresCompteAdminPage from './pages/ParametresCompteAdminPage'
import SuperAdminLayout from './pages/SuperAdminLayout'
import SuperAdminPage from './pages/SuperAdminPage'
import LegacyRedirect from './components/LegacyRedirect'


function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/mot-de-passe/nouveau" element={<ResetPasswordPage />} />
        <Route path="/login/benevole" element={<BenevoleLoginPage />} />
        <Route path="/login/vendeur" element={<VendeurLoginPage />} />
        <Route path="/adhesion/:slug" element={<DemandeAdhesionPage />} />
        <Route path="/desinscription" element={<DesinscriptionMailingPage />} />
        <Route path="/decouvrir" element={<DecouvrirPage />} />
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
              <Route path="parametres/recus-fiscaux" element={<ParametresRecusFiscauxPage />} />
            </Route>
            <Route element={<FeatureGuard feature="adherents" />}>
              <Route path="adherents" element={<AdherentsPage />} />
              <Route path="adherents/demandes" element={<DemandesAdhesionPage />} />
              <Route path="communication/emailing" element={<CampagneMailingPage />} />
              <Route path="communication/courrier" element={<CampagneCourrierPage />} />
              <Route path="parametres/adhesions" element={<ParametresAdhesionsPage />} />
              <Route path="parametres/integrations" element={<ParametresIntegrationsPage />} />
            </Route>
            <Route element={<FeatureGuard feature={['dons', 'adherents']} />}>
              <Route path="activites" element={<ActivitesPage />} />
            </Route>
            <Route element={<FeatureGuard feature="evenements" />}>
              <Route path="activites/porte-monnaie" element={<EvenementsPage />} />
              <Route path="activites/porte-monnaie/:id" element={<EvenementDetailPage />} />
              <Route path="parametres/porte-monnaie" element={<ParametresPorteMonnaiePage />} />
            </Route>
            {/* Anciennes adresses (réorganisation du menu, 2026-10) : redirigées vers les nouvelles,
                hors FeatureGuard — la page cible applique sa propre garde de module. */}
            <Route path="comptabilite" element={<LegacyRedirect to="/admin/statistiques" />} />
            <Route path="adherents/campagne-mailing" element={<LegacyRedirect to="/admin/communication/emailing" />} />
            <Route path="adherents/campagne-courrier" element={<LegacyRedirect to="/admin/communication/courrier" />} />
            <Route path="evenements" element={<LegacyRedirect to="/admin/activites/porte-monnaie" />} />
            <Route path="evenements/:id" element={<LegacyRedirect to="/admin/activites/porte-monnaie/:id" />} />
            <Route path="parametres/fiscal" element={<LegacyRedirect to="/admin/parametres/recus-fiscaux" />} />
            <Route path="parametres/adherents" element={<LegacyRedirect to="/admin/parametres/adhesions" />} />
            <Route path="parametres/suivi" element={<LegacyRedirect to="/admin/parametres/journal" />} />
            <Route path="parametres" element={<ParametresOrganisationPage />} />
            <Route path="parametres/equipe" element={<ParametresEquipePage />} />
            <Route path="parametres/codes-pin" element={<ParametresCodesPinPage />} />
            <Route path="parametres/journal" element={<ParametresJournalPage />} />
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
      </Routes>
    </AuthProvider>
  )
}

export default App
