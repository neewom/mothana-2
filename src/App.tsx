import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import HomePage from './pages/HomePage'
import AdminLoginPage from './pages/AdminLoginPage'
import BenevoleLoginPage from './pages/BenevoleLoginPage'
import AdminLayout from './pages/AdminLayout'
import BenevolePage from './pages/BenevolePage'
import DonsPage from './pages/DonsPage'
import ParticipantsPage from './pages/ParticipantsPage'
import ActivitesPage from './pages/ActivitesPage'
import RecusFiscauxPage from './pages/RecusFiscauxPage'
import ParametresPage from './pages/ParametresPage'
import SuperAdminLayout from './pages/SuperAdminLayout'
import SuperAdminPage from './pages/SuperAdminPage'


function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login/admin" element={<AdminLoginPage />} />
        <Route path="/login/benevole" element={<BenevoleLoginPage />} />

        {/* Admin (protected) */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dons" element={<DonsPage />} />
            <Route path="participants" element={<ParticipantsPage />} />
            <Route path="activites" element={<ActivitesPage />} />
            <Route path="recus" element={<RecusFiscauxPage />} />
            <Route path="parametres" element={<ParametresPage />} />
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
