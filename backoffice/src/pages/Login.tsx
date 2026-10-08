import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, App, Button, Form, Input, Segmented, Space, Typography } from 'antd'
import { LockOutlined, MailOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons'
import { errorMessage, inscrire, login, motDePasseOublie, reinitialiserMotDePasse, verifier2fa } from '../api'
import { useAuth } from '../auth'
import HeroConnexion from '../components/HeroConnexion'
import Marque from '../components/Marque'
import { EASE, mouvementReduit } from '../motion'
import type { LoginResponse } from '../types'

type Etape = 'connexion' | '2fa' | 'oubli' | 'reinitialisation' | 'inscription'

export default function LoginPage() {
  const { connecter } = useAuth()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [etape, setEtape] = useState<Etape>('connexion')
  const [email, setEmail] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const aboutir = (r: LoginResponse) => {
    if (r.twoFactor) {
      setEtape('2fa')
      setInfo('Un code à 6 chiffres vient de vous être envoyé par email.')
      return
    }
    if (r.token && r.user) {
      connecter(r.token, r.user)
      message.success(`Bienvenue ${r.user.prenom ?? ''}`)
      const depuis = (location.state as { depuis?: string } | null)?.depuis
      navigate(depuis && depuis !== '/connexion' ? depuis : '/', { replace: true })
    }
  }

  const executer = async (action: () => Promise<void>) => {
    setChargement(true)
    setErreur(null)
    try {
      await action()
    } catch (e) {
      setErreur(errorMessage(e, 'Connexion impossible. Le serveur est-il démarré ?'))
    } finally {
      setChargement(false)
    }
  }

  // Chaque étape du formulaire (connexion, 2FA, oubli…) entre en cascade.
  const boite = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      if (mouvementReduit()) return
      gsap.from('.connexion-boite > *, .ant-form-item, .ant-form > .ant-btn', {
        autoAlpha: 0,
        y: 12,
        duration: 0.5,
        ease: EASE,
        stagger: 0.04,
        clearProps: 'transform,opacity,visibility',
      })
    },
    { scope: boite, dependencies: [etape], revertOnUpdate: true },
  )

  const changer = (e: Etape) => {
    setEtape(e)
    setErreur(null)
    setInfo(null)
  }

  return (
    <div className="connexion">
      <HeroConnexion />

      <div className="connexion-formulaire">
        <div className="connexion-boite" ref={boite}>
          <div className="connexion-marque-mobile">
            <Marque clair />
          </div>
          {(etape === 'connexion' || etape === 'inscription') && (
            <Segmented
              block
              value={etape}
              onChange={(v) => changer(v as Etape)}
              options={[
                { label: 'Connexion', value: 'connexion' },
                { label: 'Créer un compte', value: 'inscription' },
              ]}
              style={{ marginBottom: 24 }}
            />
          )}

          <Typography.Title level={3}>
            {
              {
                connexion: 'Bon retour',
                '2fa': 'Double authentification',
                oubli: 'Mot de passe oublié',
                reinitialisation: 'Nouveau mot de passe',
                inscription: 'Créer un compte client',
              }[etape]
            }
          </Typography.Title>
          <span className="connexion-intro">
            {
              {
                connexion: 'Connectez-vous pour accéder à votre espace.',
                '2fa': 'Saisissez le code reçu pour confirmer votre identité.',
                oubli: 'Nous vous envoyons un code de réinitialisation par email.',
                reinitialisation: 'Choisissez un nouveau mot de passe.',
                inscription: 'Rechargez sur tout le réseau et suivez vos dépenses.',
              }[etape]
            }
          </span>

          {erreur && <Alert type="error" message={erreur} showIcon style={{ marginBottom: 16 }} />}
          {info && <Alert type="info" message={info} showIcon style={{ marginBottom: 16 }} />}

          {etape === 'connexion' && (
            <Form
              layout="vertical"
              requiredMark={false}
              onFinish={(v: { email: string; password: string }) =>
                executer(async () => {
                  setEmail(v.email)
                  aboutir(await login(v.email, v.password))
                })
              }
            >
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email valide requis' }]}>
                <Input prefix={<MailOutlined />} size="large" autoComplete="email" placeholder="vous@exemple.tn" autoFocus />
              </Form.Item>
              <Form.Item name="password" label="Mot de passe" rules={[{ required: true, message: 'Mot de passe requis' }]}>
                <Input.Password prefix={<LockOutlined />} size="large" autoComplete="current-password" placeholder="Votre mot de passe" />
              </Form.Item>
              <Button className="bouton-signature" type="primary" htmlType="submit" size="large" block loading={chargement}>
                Se connecter
              </Button>
              <Button type="link" block style={{ marginTop: 8 }} onClick={() => changer('oubli')}>
                Mot de passe oublié ?
              </Button>
            </Form>
          )}

          {etape === '2fa' && (
            <Form
              layout="vertical"
              requiredMark={false}
              onFinish={(v: { code: string }) => executer(async () => aboutir(await verifier2fa(email, v.code)))}
            >
              <Form.Item name="code" label="Code reçu par email" rules={[{ required: true, len: 6, message: 'Code à 6 chiffres' }]}>
                <Input.OTP length={6} size="large" autoFocus />
              </Form.Item>
              <Button className="bouton-signature" type="primary" htmlType="submit" size="large" block loading={chargement} icon={<SafetyOutlined />}>
                Vérifier
              </Button>
              <Button type="link" block onClick={() => changer('connexion')}>
                Retour
              </Button>
            </Form>
          )}

          {etape === 'oubli' && (
            <Form
              layout="vertical"
              requiredMark={false}
              onFinish={(v: { email: string }) =>
                executer(async () => {
                  setEmail(v.email)
                  const r = await motDePasseOublie(v.email)
                  setEtape('reinitialisation')
                  setInfo(r.message)
                })
              }
            >
              <Form.Item name="email" label="Email du compte" rules={[{ required: true, type: 'email' }]}>
                <Input prefix={<MailOutlined />} size="large" />
              </Form.Item>
              <Button className="bouton-signature" type="primary" htmlType="submit" size="large" block loading={chargement}>
                Recevoir un code
              </Button>
              <Button type="link" block onClick={() => changer('connexion')}>
                Retour
              </Button>
            </Form>
          )}

          {etape === 'reinitialisation' && (
            <Form
              layout="vertical"
              requiredMark={false}
              onFinish={(v: { code: string; password: string }) =>
                executer(async () => {
                  const r = await reinitialiserMotDePasse(email, v.code, v.password)
                  message.success(r.message)
                  changer('connexion')
                })
              }
            >
              <Form.Item name="code" label="Code reçu" rules={[{ required: true, len: 6 }]}>
                <Input.OTP length={6} size="large" />
              </Form.Item>
              <Form.Item name="password" label="Nouveau mot de passe" rules={[{ required: true, min: 6 }]}>
                <Input.Password prefix={<LockOutlined />} size="large" autoComplete="new-password" />
              </Form.Item>
              <Button className="bouton-signature" type="primary" htmlType="submit" size="large" block loading={chargement}>
                Réinitialiser
              </Button>
              <Button type="link" block onClick={() => changer('connexion')}>
                Retour
              </Button>
            </Form>
          )}

          {etape === 'inscription' && (
            <Form
              layout="vertical"
              requiredMark={false}
              onFinish={(v: { prenom: string; nom: string; email: string; telephone?: string; password: string }) =>
                executer(async () => aboutir(await inscrire(v)))
              }
            >
              <Space.Compact block>
                <Form.Item name="prenom" label="Prénom" rules={[{ required: true }]} style={{ width: '50%' }}>
                  <Input prefix={<UserOutlined />} />
                </Form.Item>
                <Form.Item name="nom" label="Nom" rules={[{ required: true }]} style={{ width: '50%' }}>
                  <Input />
                </Form.Item>
              </Space.Compact>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input prefix={<MailOutlined />} />
              </Form.Item>
              <Form.Item name="telephone" label="Téléphone">
                <Input placeholder="+216 …" />
              </Form.Item>
              <Form.Item name="password" label="Mot de passe" rules={[{ required: true, min: 6 }]}>
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Button className="bouton-signature" type="primary" htmlType="submit" size="large" block loading={chargement}>
                Créer mon compte
              </Button>
            </Form>
          )}
        </div>
      </div>
    </div>
  )
}
