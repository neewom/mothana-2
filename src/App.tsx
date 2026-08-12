import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import HomePage from './pages/HomePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import BenevoleLoginPage from './pages/BenevoleLoginPage'
import DemandeAdhesionPage from './pages/DemandeAdhesionPage'
import AdminLayout from './pages/AdminLayout'
import BenevolePage from './pages/BenevolePage'
import DashboardPage from './pages/DashboardPage'
import DonsPage from './pages/DonsPage'
import ParticipantsPage from './pages/ParticipantsPage'
import ActivitesPage from './pages/ActivitesPage'
import RecusFiscauxPage from './pages/RecusFiscauxPage'
import AdherentsPage from './pages/AdherentsPage'
import DemandesAdhesionPage from './pages/DemandesAdhesionPage'
import ComptabilitePage from './pages/ComptabilitePage'
import ParametresOrganisationPage from './pages/ParametresOrganisationPage'
import ParametresFiscalPage from './pages/ParametresFiscalPage'
import ParametresAdherentsPage from './pages/ParametresAdherentsPage'
import ParametresSuiviPage from './pages/ParametresSuiviPage'
import SuperAdminLayout from './pages/SuperAdminLayout'
import SuperAdminPage from './pages/SuperAdminPage'


function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/mot-de-passe/nouveau" element={<ResetPasswordPage />} />
        <Route path="/login/benevole" element={<BenevoleLoginPage />} />
        <Route path="/adhesion/:slug" element={<DemandeAdhesionPage />} />

        {/* Admin (protected) */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="dons" element={<DonsPage />} />
            <Route path="participants" element={<ParticipantsPage />} />
            <Route path="activites" element={<ActivitesPage />} />
            <Route path="recus" element={<RecusFiscauxPage />} />
            <Route path="adherents" element={<AdherentsPage />} />
            <Route path="adherents/demandes" element={<DemandesAdhesionPage />} />
            <Route path="comptabilite" element={<ComptabilitePage />} />
            <Route path="parametres" element={<ParametresOrganisationPage />} />
            <Route path="parametres/fiscal" element={<ParametresFiscalPage />} />
            <Route path="parametres/adherents" element={<ParametresAdherentsPage />} />
            <Route path="parametres/suivi" element={<ParametresSuiviPage />} />
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
      </Routes>
    </AuthProvider>
  )
}

export default App
