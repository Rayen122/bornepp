import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EtatBadge } from '@/components/etat-badge';
import { Carte } from '@/components/ui/carte';
import { Texte } from '@/components/ui/texte';
import { Rayons } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { libelleTarif, tarifDeBorne } from '@/lib/tarifs';
import type { Borne, Connecteur } from '@/types/domain';

export const NOM_PRISE: Record<string, string> = {
  CCS: 'CCS',
  Type2: 'Type 2',
  CHAdeMO: 'CHAdeMO',
  AC: 'AC',
  DC: 'DC',
};

/** Regroupe les prises identiques : « CCS · 1/2 ». */
function regrouper(connecteurs: Connecteur[]) {
  const groupes = new Map<string, { type: string; total: number; libres: number }>();
  for (const conn of connecteurs) {
    const g = groupes.get(conn.type) ?? { type: conn.type, total: 0, libres: 0 };
    g.total += 1;
    if (conn.etat === 'disponible') g.libres += 1;
    groupes.set(conn.type, g);
  }
  return [...groupes.values()];
}

type Props = {
  borne: Borne;
  favori?: boolean;
  /** Présentation compacte (carrousel, fiche flottante de la carte). */
  compacte?: boolean;
};

export function BorneCard({ borne, favori = false, compacte = false }: Props) {
  const { c } = useTheme();
  const publique = borne.source === 'publique';
  const rapide = (borne.puissanceKw ?? 0) >= 50;
  const groupes = regrouper(borne.connecteurs);

  return (
    <Carte
      accessibilityLabel={`Ouvrir ${borne.nom}`}
      onPress={() => router.push({ pathname: '/borne/[id]', params: { id: String(borne.id) } })}
      style={styles.carte}>
      <View style={styles.haut}>
        <View style={styles.titres}>
          {(publique || favori || rapide) && (
            <View style={styles.surtitres}>
              {favori && (
                <Texte variant="label" color="primary">
                  Favorite
                </Texte>
              )}
              {rapide && !publique && (
                <Texte variant="label" color="info">
                  Charge rapide
                </Texte>
              )}
              {publique && (
                <Texte variant="label" color="textFaint">
                  {borne.operateur ?? 'Autre opérateur'}
                </Texte>
              )}
            </View>
          )}
          <Texte variant="subheading" numberOfLines={1}>
            {borne.nom}
          </Texte>
          <Texte variant="caption" color="textMuted" numberOfLines={1}>
            {borne.adresse}
          </Texte>
          <View style={styles.badge}>
            <EtatBadge etat={borne.etat} />
          </View>
        </View>

        <View style={[styles.puissance, { borderLeftColor: c.border }]}>
          <Texte variant="number" style={styles.kw}>
            {borne.puissanceKw ?? '—'}
          </Texte>
          <Texte variant="captionStrong" color="textMuted">
            kW max
          </Texte>
        </View>
      </View>

      {!compacte && (groupes.length > 0 || !publique) && (
        <View style={[styles.bas, { borderTopColor: c.border }]}>
          <View style={styles.prises}>
            {groupes.map((g) => (
              <View key={g.type} style={[styles.prise, { backgroundColor: c.surfaceAlt }]}>
                <Texte variant="captionStrong">{NOM_PRISE[g.type] ?? g.type}</Texte>
                {!publique && (
                  <Texte
                    variant="captionStrong"
                    color={g.libres > 0 ? 'success' : 'textFaint'}
                    style={styles.chiffres}>
                    {g.libres}/{g.total}
                  </Texte>
                )}
              </View>
            ))}
          </View>
          {!publique && (
            <Texte variant="captionStrong" color="copper" style={styles.chiffres}>
              {libelleTarif(tarifDeBorne(borne)).montant}
              <Texte variant="caption" color="textMuted">
                {' '}
                {libelleTarif(tarifDeBorne(borne)).unite}
              </Texte>
            </Texte>
          )}
        </View>
      )}
    </Carte>
  );
}

const styles = StyleSheet.create({
  carte: { gap: 14 },
  haut: { flexDirection: 'row', gap: 14 },
  titres: { flex: 1, gap: 3 },
  surtitres: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  badge: { marginTop: 8 },
  puissance: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 64,
  },
  kw: { fontSize: 30, lineHeight: 34 },
  bas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 8,
  },
  prises: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  prise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Rayons.sm,
    paddingHorizontal: 10,
    height: 28,
  },
  chiffres: { fontVariant: ['tabular-nums'] },
});
