import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Result, Spin, Button } from 'antd'
import { useAuth } from './auth'
import type { Module } from './types'
import AppLayout, { MENU_PERSONNEL } from './components/AppLayout'
import EspaceLayout from './components/EspaceLayout'
import LoginPage from './pages/Login'

const DashboardPage = lazy(() => import('./pages/Dashboard'))
const SupervisionPage = lazy(() => import('./pages/Supervision'))
const CartePage = lazy(() => import('./pages/Carte'))
const BornesPage = lazy(() => import('./pages/Bornes'))
const BorneDetailPage = lazy(() => import('./pages/BorneDetail'))
const SessionsPage = lazy(() => import('./pages/Sessions'))
const UtilisateursPage = lazy(() => import('./pages/Utilisateurs'))
const UtilisateurDetailPage = lazy(() => import('./pages/UtilisateurDetail'))
const BadgesPage = lazy(() => import('./pages/Badges'))
const VehiculesPage = lazy(() => import('./pages/Vehicules'))
const FacturationPage = lazy(() => import('./pages/Facturation'))
const TarificationPage = lazy(() => import('./pages/Tarification'))
const MaintenancePage = lazy(() => import('./pages/Maintenance'))
const AlertesPage = lazy(() => import('./pages/Alertes'))
const FirmwarePage = lazy(() => import('./pages/Firmware'))
const RapportsPage = lazy(() => import('./pages/Rapports'))
const DocumentsPage = lazy(() => import('./pages/Documents'))
const ParametresPage = lazy(() => import('./pages/Parametres'))
const AuditPage = lazy(() => import('./pages/Audit'))
const ProfilPage = lazy(() => import('./pages/Profil'))

const EspaceAccueil = lazy(() => import('./pages/espace/Accueil'))
const EspaceCarte = lazy(() => import('./pages/espace/CarteClient'))
const EspaceRecharges = lazy(() => import('./pages/espace/Recharges'))
const EspacePaiements = lazy(() => import('./pages/espace/Paiements'))
const EspaceVehicules = lazy(() => import('./pages/espace/VehiculesClient'))
const EspaceBadges = lazy(() => import('./pages/espace/BadgesClient'))
const EspaceAbonnement = lazy(() => import('./pages/espace/Abonnement'))

function Chargement() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  )
}

/** Garde de route : le module doit être accessible au rôle (matrice §7). */
function Garde({ module, children }: { module: Module; children: ReactNode }) {
  const { peut } = useAuth()
  if (!peut(module)) {
    return (
      <Result
        status="403"
        title="Accès refusé"
        subTitle="Votre rôle ne donne pas accès à ce module."
        extra={<Button href="/">Retour à l'accueil</Button>}
      />
    )
  }
  return <>{children}</>
}

/** Première page autorisée pour le personnel. */
function Accueil() {
  const { user, peut } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
  if (user.role === 'client') return <Navigate to="/espace" replace />
  const premiere = MENU_PERSONNEL.find((m) => peut(m.module))
  return <Navigate to={premiere?.chemin ?? '/profil'} replace />
}

function Protege({ children, client }: { children: ReactNode; client?: boolean }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/connexion" state={{ depuis: location.pathname }} replace />
  if (client && user.role !== 'client') return <Navigate to="/" replace />
  if (!client && user.role === 'client') return <Navigate to="/espace" replace />
  return <>{children}</>
}

export default function App() {
  const { user } = useAuth()

  return (
    <Suspense fallback={<Chargement />}>
      <Routes>
        <Route path="/connexion" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<Accueil />} />

        <Route
          element={
            <Protege>
              <AppLayout />
            </Protege>
          }
        >
          <Route path="/tableau-de-bord" element={<Garde module="dashboard"><DashboardPage /></Garde>} />
          <Route path="/supervision" element={<Garde module="supervision"><SupervisionPage /></Garde>} />
          <Route path="/carte" element={<Garde module="supervision"><CartePage /></Garde>} />
          <Route path="/bornes" element={<Garde module="bornes"><BornesPage /></Garde>} />
          <Route path="/bornes/:id" element={<Garde module="bornes"><BorneDetailPage /></Garde>} />
          <Route path="/sessions" element={<Garde module="sessions"><SessionsPage /></Garde>} />
          <Route path="/utilisateurs" element={<Garde module="utilisateurs"><UtilisateursPage /></Garde>} />
          <Route path="/utilisateurs/:id" element={<Garde module="utilisateurs"><UtilisateurDetailPage /></Garde>} />
          <Route path="/badges" element={<Garde module="rfid"><BadgesPage /></Garde>} />
          <Route path="/vehicules" element={<Garde module="vehicules"><VehiculesPage /></Garde>} />
          <Route path="/facturation" element={<Garde module="paiements"><FacturationPage /></Garde>} />
          <Route path="/tarification" element={<Garde module="tarification"><TarificationPage /></Garde>} />
          <Route path="/maintenance" element={<Garde module="maintenance"><MaintenancePage /></Garde>} />
          <Route path="/alertes" element={<Garde module="alertes"><AlertesPage /></Garde>} />
          <Route path="/firmware" element={<Garde module="firmware"><FirmwarePage /></Garde>} />
          <Route path="/rapports" element={<Garde module="rapports"><RapportsPage /></Garde>} />
          <Route path="/documents" element={<Garde module="documents"><DocumentsPage /></Garde>} />
          <Route path="/parametres" element={<Garde module="parametres"><ParametresPage /></Garde>} />
          <Route path="/audit" element={<Garde module="audit"><AuditPage /></Garde>} />
          <Route path="/profil" element={<ProfilPage />} />
        </Route>

        <Route
          path="/espace"
          element={
            <Protege client>
              <EspaceLayout />
            </Protege>
          }
        >
          <Route index element={<EspaceAccueil />} />
          <Route path="carte" element={<EspaceCarte />} />
          <Route path="recharges" element={<EspaceRecharges />} />
          <Route path="paiements" element={<EspacePaiements />} />
          <Route path="vehicules" element={<EspaceVehicules />} />
          <Route path="badges" element={<EspaceBadges />} />
          <Route path="abonnement" element={<EspaceAbonnement />} />
          <Route path="profil" element={<ProfilPage />} />
        </Route>

        <Route
          path="*"
          element={<Result status="404" title="Page introuvable" extra={<Button href="/">Accueil</Button>} />}
        />
      </Routes>
    </Suspense>
  )
}
