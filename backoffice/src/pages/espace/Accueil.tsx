import { Link } from 'react-router-dom'
import { App, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd'
import { CarOutlined, DollarOutlined, EnvironmentOutlined, FieldTimeOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import ReactECharts from '../../components/Graphique'
import { errorMessage, espace } from '../../api'
import { useAuth } from '../../auth'
import { formatDuree, formatEnergie, formatMontant, formatNombre } from '../../format'
import { BoutonRecharge } from './commun'
import { Kpi } from '../../components/commun'
import { Anneau } from '../../components/Premium'
import { ChiffreAnime } from '../../motion'

export default function EspaceAccueil() {
  const { user, rafraichir } = useAuth()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const { data: active } = useQuery({ queryKey: ['espace', 'active'], queryFn: espace.sessionActive, refetchInterval: 10_000 })
  const { data: stats } = useQuery({ queryKey: ['espace', 'stats'], queryFn: espace.statistiques })
  const { data: souscription } = useQuery({ queryKey: ['espace', 'souscription'], queryFn: espace.souscription })

  const arret = useMutation({
    mutationFn: (id: number) => espace.arreter(id),
    onSuccess: (s) => {
      message.success(`Recharge terminée : ${formatEnergie(s.energieKwh)} pour ${formatMontant(s.prix)}`)
      void rafraichir()
      queryClient.invalidateQueries({ queryKey: ['espace'] })
    },
    onError: (e) => message.error(errorMessage(e)),
  })

  const duree = active ? dayjs().diff(dayjs(active.dateDebut), 'minute') : 0

  return (
    <div className="pile">
      <section className="bandeau-encre bandeau-client" aria-label="Mon wallet">
        <div className="bandeau-colonne bandeau-principal">
          <span className="bandeau-surtitre">Bonjour {user?.prenom}</span>
          <span className="bandeau-legende">Solde de mon wallet</span>
          <div className="bandeau-valeur">
            <ChiffreAnime valeur={formatMontant(user?.soldeWallet)} />
          </div>
          <Space wrap style={{ marginTop: 10 }}>
            <BoutonRecharge />
            <Link to="/espace/paiements"><Button className="bouton-sur-encre">Mes paiements</Button></Link>
          </Space>
        </div>
        <div className="bandeau-colonne">
          <span className="bandeau-surtitre">Mon abonnement</span>
          {souscription ? (
            <>
              <div className="bandeau-abonnement">
                {souscription.abonnementNom} <Tag color="green" style={{ marginInlineStart: 6 }}>Actif</Tag>
              </div>
              <span className="bandeau-legende">
                {souscription.remisePourcent} % de remise · {souscription.kwhInclus} kWh inclus / mois
                <br />
                Jusqu'au {dayjs(souscription.dateFin).format('DD/MM/YYYY')}
              </span>
              <Link to="/espace/abonnement" className="lien-sur-encre">Gérer mon abonnement →</Link>
            </>
          ) : (
            <>
              <span className="bandeau-legende">Économisez sur chaque recharge avec une formule mensuelle.</span>
              <Link to="/espace/abonnement" className="lien-sur-encre">Découvrir les formules →</Link>
            </>
          )}
        </div>
      </section>

      <Card title={<Space><ThunderboltOutlined />Recharge en cours</Space>}>
        {active ? (
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={8} style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-block' }}>
                <Anneau pourcentage={active.pourcentageBatterie ?? 0} taille={150} epaisseur={12} couleur="#F04257" piste="#2A2A31">
                  <strong className="anneau-clair">{active.pourcentageBatterie ?? 0}<small>%</small></strong>
                  <span className="anneau-clair-legende">batterie</span>
                </Anneau>
              </div>
            </Col>
            <Col xs={24} md={16}>
              <Typography.Title level={4} style={{ marginTop: 0 }}>{active.borneNom} <Tag>{active.typeConnecteur}</Tag>{active.etat === 'en_pause' && <Tag color="orange">En pause</Tag>}</Typography.Title>
              <Row gutter={16}>
                <Col span={6}><Statistic title="Énergie" value={formatEnergie(active.energieKwh)} /></Col>
                <Col span={6}><Statistic title="Puissance" value={`${formatNombre(active.puissanceInstantaneeKw, 1)} kW`} /></Col>
                <Col span={6}><Statistic title="Durée" value={formatDuree(duree)} /></Col>
                <Col span={6}><Statistic title="Coût actuel" value={formatMontant(active.prix)} /></Col>
              </Row>
              <Button danger icon={<StopOutlined />} style={{ marginTop: 16 }} loading={arret.isPending}
                onClick={() => modal.confirm({ title: 'Arrêter la recharge ?', content: 'Le montant sera débité de votre wallet et la facture émise.', okText: 'Arrêter', okButtonProps: { danger: true }, onOk: () => arret.mutateAsync(active.id) })}>
                Arrêter la recharge
              </Button>
            </Col>
          </Row>
        ) : (
          <Empty description="Aucune recharge en cours">
            <Link to="/espace/carte"><Button type="primary" icon={<EnvironmentOutlined />}>Trouver une borne</Button></Link>
          </Empty>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Kpi titre="Recharges" valeur={stats?.sessionsTotal ?? 0} icone={<FieldTimeOutlined />} couleur="#60A5FA" tendance={stats?.parMois.map((m) => m.sessions)} />
        </Col>
        <Col xs={12} md={6}>
          <Kpi titre="Énergie" valeur={formatEnergie(stats?.energieTotaleKwh)} icone={<ThunderboltOutlined />} couleur="#F04257" tendance={stats?.parMois.map((m) => m.kwh)} />
        </Col>
        <Col xs={12} md={6}>
          <Kpi titre="Dépenses" valeur={formatMontant(stats?.depensesTotal)} icone={<DollarOutlined />} couleur="#F0955A" tendance={stats?.parMois.map((m) => m.prix)} />
        </Col>
        <Col xs={12} md={6}>
          <Kpi titre="Autonomie ajoutée" valeur={formatNombre(stats?.kmAjoutes)} suffixe="km" icone={<CarOutlined />} couleur="#A78BFA" />
        </Col>
      </Row>
      <Card title="Ma consommation (6 mois)" size="small">
        <ReactECharts
          notMerge
          style={{ height: 260 }}
          option={{
            tooltip: { trigger: 'axis' },
            legend: { top: 0 },
            grid: { left: 44, right: 44, top: 36, bottom: 24 },
            xAxis: { type: 'category', data: stats?.parMois.map((m) => dayjs(`${m.mois}-01`).format('MMM YY')) },
            yAxis: [{ type: 'value', name: 'kWh' }, { type: 'value', name: 'DT', splitLine: { show: false } }],
            series: [
              { name: 'Énergie (kWh)', type: 'bar', data: stats?.parMois.map((m) => m.kwh), itemStyle: { color: '#F04257', borderRadius: [4, 4, 0, 0] } },
              { name: 'Dépenses', type: 'line', yAxisIndex: 1, smooth: 0.3, smoothMonotone: 'x', data: stats?.parMois.map((m) => m.prix), itemStyle: { color: '#F0955A' } },
            ],
          }}
        />
      </Card>
    </div>
  )
}
