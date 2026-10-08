import { useState } from 'react'
import { App, Button, InputNumber, Modal, Space, Typography } from 'antd'
import { WalletOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorMessage, espace } from '../../api'
import { useAuth } from '../../auth'
import { formatMontant } from '../../format'

/** Rechargement du wallet (mode sandbox : crédit immédiat, sans saisie de carte). */
export function BoutonRecharge({ type = 'primary' }: { type?: 'primary' | 'default' }) {
  const { rafraichir } = useAuth()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const [montant, setMontant] = useState<number>(20)

  const recharge = useMutation({
    mutationFn: () => espace.recharger(montant),
    onSuccess: (r) => {
      message.success(`Wallet rechargé : ${formatMontant(r.soldeWallet)}`)
      setOuvert(false)
      void rafraichir()
      queryClient.invalidateQueries({ queryKey: ['espace'] })
    },
    onError: (e) => message.error(errorMessage(e)),
  })

  return (
    <>
      <Button type={type} icon={<WalletOutlined />} onClick={() => setOuvert(true)}>Recharger mon wallet</Button>
      <Modal open={ouvert} title="Recharger mon wallet" onCancel={() => setOuvert(false)} onOk={() => recharge.mutate()} okText={`Payer ${formatMontant(montant)}`} confirmLoading={recharge.isPending}>
        <Space wrap style={{ marginBottom: 12 }}>
          {[10, 20, 50, 100].map((m) => (
            <Button key={m} type={montant === m ? 'primary' : 'default'} onClick={() => setMontant(m)}>{formatMontant(m, 0)}</Button>
          ))}
        </Space>
        <InputNumber min={1} max={1000} value={montant} onChange={(v) => setMontant(Number(v ?? 1))} addonAfter="DT" style={{ width: '100%' }} />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
          Paiement par carte bancaire via le prestataire de paiement (mode démonstration : le crédit est immédiat).
        </Typography.Paragraph>
      </Modal>
    </>
  )
}
