import { Suspense } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Button, Dropdown, Grid, Layout, Menu, Space, Spin } from 'antd'
import {
  CarOutlined,
  CreditCardOutlined,
  CrownOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  IdcardOutlined,
  LogoutOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth'
import { usePlateforme } from '../hooks/usePlateforme'
import { useTempsReel } from '../hooks/useTempsReel'
import { formatMontant } from '../format'
import Marque from './Marque'
import { TransitionPage } from '../motion'

const MENU = [
  { key: '/espace', icon: <HomeOutlined />, label: 'Accueil' },
  { key: '/espace/carte', icon: <EnvironmentOutlined />, label: 'Bornes' },
  { key: '/espace/recharges', icon: <UnorderedListOutlined />, label: 'Mes recharges' },
  { key: '/espace/paiements', icon: <CreditCardOutlined />, label: 'Paiements' },
  { key: '/espace/vehicules', icon: <CarOutlined />, label: 'Véhicules' },
  { key: '/espace/badges', icon: <IdcardOutlined />, label: 'Badges' },
  { key: '/espace/abonnement', icon: <CrownOutlined />, label: 'Abonnement' },
]

/** Espace client web : bornes et paiements en lecture (§7), données personnelles. */
export default function EspaceLayout() {
  const { user, deconnecter } = useAuth()
  const plateforme = usePlateforme()
  const navigate = useNavigate()
  const location = useLocation()
  const mobile = !Grid.useBreakpoint().md
  useTempsReel(true, false)

  const selection = [...MENU].reverse().find((m) => location.pathname.startsWith(m.key))?.key ?? '/espace'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header className="entete entete-espace">
        <Link to="/espace" className="marque marque-claire" style={{ paddingInline: 0 }} aria-label={`${plateforme.nom} — accueil`}>
          <Marque clair replie={mobile} />
        </Link>
        <Menu
          mode="horizontal"
          selectedKeys={[selection]}
          items={MENU}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none', marginInline: 16 }}
        />
        <Space>
          {!mobile && (
            <Button icon={<WalletOutlined style={{ color: 'var(--cuivre)' }} />} onClick={() => navigate('/espace/paiements')} style={{ fontWeight: 700 }}>
              {formatMontant(user?.soldeWallet)}
            </Button>
          )}
          <Dropdown
            menu={{
              items: [
                { key: 'profil', icon: <UserOutlined />, label: 'Mon profil', onClick: () => navigate('/espace/profil') },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Se déconnecter', danger: true, onClick: () => void deconnecter() },
              ],
            }}
          >
            <span className="avatar-utilisateur">
              <Avatar size={32}>{(user?.prenom?.[0] ?? '') + (user?.nom?.[0] ?? '')}</Avatar>
              {!mobile && (
                <span className="avatar-nom">
                  <strong>{user?.prenom}</strong>
                  <span>Espace client</span>
                </span>
              )}
            </span>
          </Dropdown>
        </Space>
      </Layout.Header>
      <Layout.Content className="contenu contenu-espace">
        <Suspense fallback={<div className="chargement-page"><Spin size="large" /></div>}>
          <TransitionPage cle={location.pathname}>
            <Outlet />
          </TransitionPage>
        </Suspense>
      </Layout.Content>
    </Layout>
  )
}
