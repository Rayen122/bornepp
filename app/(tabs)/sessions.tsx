import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NOM_PRISE } from '@/components/borne-card';
import { BarresMois } from '@/components/ui/barres-mois';
import { Carte } from '@/components/ui/carte';
import { ChiffreAnime } from '@/components/ui/chiffre-anime';
import { Squelette } from '@/components/ui/squelette';
import { Texte } from '@/components/ui/texte';
import { BarreTitreCompacte } from '@/components/ui/barre-titre-compacte';
import { Espace, Rayons, type CouleurSemantique } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as api from '@/lib/api';
import { formatDuree, formatHeure, formatMois, formatNombre, formatPrix } from '@/lib/format';
import type { EtatSession, KpisClient, SessionRecharge } from '@/types/domain';

const ETAT_SESSION: Record<EtatSession, { label: string; couleur: CouleurSemantique }> = {
  en_cours: { label: 'En cours', couleur: 'primary' },
  en_pause: { label: 'En pause', couleur: 'warning' },
  terminee: { label: 'Terminée', couleur: 'success' },
  annulee: { label: 'Annulée', couleur: 'danger' },
};

function LigneSession({ session }: { session: SessionRecharge }) {
  const { c } = useTheme();
  const date = new Date(session.dateDebut);
  const etat = ETAT_SESSION[session.etat];
  const annulee = session.etat === 'annulee';

  return (
    <Carte
      style={styles.ligne}
      accessibilityLabel={`Détail de la recharge du ${date.toLocaleDateString('fr-FR')}`}
      onPress={() =>
        session.etat === 'en_cours' || session.etat === 'en_pause'
          ? router.push('/recharge')
          : router.push({ pathname: '/session/[id]', params: { id: String(session.id) } })
      }>
      <View style={[styles.date, { borderRightColor: c.border }]}>
        <Texte variant="number" style={styles.jour}>
          {date.getDate()}
        </Texte>
        <Texte variant="label" color="textMuted" style={styles.moisCourt}>
          {date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
        </Texte>
      </View>

      <View style={styles.milieu}>
        <Texte variant="subheading" numberOfLines={1}>
          {session.borneNom}
        </Texte>
        <Texte variant="caption" color="textMuted" style={styles.chiffres}>
          {formatHeure(session.dateDebut)} · {NOM_PRISE[session.typeConnecteur]} ·{' '}
          {formatDuree(session.dureeMinutes)}
        </Texte>
        {session.etat !== 'terminee' && (
          <Texte variant="captionStrong" color={c[etat.couleur]}>
            {etat.label}
          </Texte>
        )}
        {session.paiementStatut === 'en_attente' && (
          <Texte variant="captionStrong" color="warning">
            Paiement à régler
          </Texte>
        )}
      </View>

      <View style={styles.droite}>
        <Texte
          variant="subheading"
          color={annulee ? 'textFaint' : 'copper'}
          style={[styles.chiffres, annulee && styles.barre]}>
          {formatPrix(session.prix)}
        </Texte>
        <Texte variant="caption" color="textMuted" style={styles.chiffres}>
          {formatNombre(session.energieKwh, 1)} kWh
        </Texte>
      </View>
    </Carte>
  );
}

export default function ActiviteScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<SessionRecharge[] | null>(null);
  const [kpis, setKpis] = useState<KpisClient | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = useCallback(async () => {
    const [s, k] = await Promise.all([api.listeSessions(), api.kpisClient()]);
    setSessions(s);
    setKpis(k);
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger().catch(() => setSessions([]));
    }, [charger])
  );

  const sections = useMemo(() => {
    const parMois = new Map<string, SessionRecharge[]>();
    for (const s of sessions ?? []) {
      const mois = formatMois(s.dateDebut);
      parMois.set(mois, [...(parMois.get(mois) ?? []), s]);
    }
    return [...parMois.entries()].map(([title, data]) => ({ title, data }));
  }, [sessions]);

  const entete = (
    <View style={styles.entete}>
      <Texte variant="title">Activité</Texte>

      <Carte style={styles.bilan}>
        <View style={styles.bilanHaut}>
          <View>
            <Texte variant="label" color="textMuted">
              Énergie rechargée
            </Texte>
            <View style={styles.enLigne}>
              <ChiffreAnime valeur={kpis?.energieTotaleKwh} variant="title" />
              <Texte variant="bodyStrong" color="textMuted">
                kWh
              </Texte>
            </View>
          </View>
          <Texte variant="caption" color="textMuted" align="right">
            6 derniers mois
          </Texte>
        </View>
        {kpis ? <BarresMois donnees={kpis.parMois} /> : <Squelette hauteur={140} rayon={Rayons.md} />}
        <View style={[styles.totaux, { borderTopColor: c.border }]}>
          <View style={styles.total}>
            <ChiffreAnime valeur={kpis?.depensesTotal} decimales={2} color="copper" unite="DT" />
            <Texte variant="label" color="textMuted">Dépensé</Texte>
          </View>
          <View style={styles.total}>
            <ChiffreAnime valeur={kpis?.sessionsTotal} />
            <Texte variant="label" color="textMuted">Recharges</Texte>
          </View>
          <View style={styles.total}>
            <ChiffreAnime valeur={kpis?.kmAjoutes} unite="km" />
            <Texte variant="label" color="textMuted">Autonomie</Texte>
          </View>
        </View>
        {kpis && (
          <Texte variant="caption" color="textFaint">
            Autonomie calculée sur une consommation moyenne de {kpis.kwhAux100Km} kWh/100 km.
          </Texte>
        )}
      </Carte>
    </View>
  );

  // Le grand titre défile avec la liste ; une barre compacte prend le relais en haut.
  const defilement = useSharedValue(0);

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[styles.liste, { paddingTop: insets.top + Espace.lg }]}
        sections={sections}
        keyExtractor={(s) => String(s.id)}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={entete}
        renderSectionHeader={({ section }) => (
          <Texte variant="label" color="textMuted" style={styles.titreSection}>
            {section.title}
          </Texte>
        )}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(400)}>
            <LigneSession session={item} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: Espace.sm }} />}
        ListEmptyComponent={
          sessions ? (
            <View style={styles.vide}>
              <Texte variant="subheading">Aucune recharge pour l’instant</Texte>
              <Texte variant="caption" color="textMuted" align="center">
                Vos sessions apparaîtront ici, avec leur coût et leur courbe de puissance.
              </Texte>
            </View>
          ) : (
            <View style={{ gap: Espace.sm, marginTop: Espace.xl }}>
              {[0, 1, 2].map((i) => (
                <Squelette key={i} hauteur={74} rayon={Rayons.lg} />
              ))}
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={async () => {
              setRafraichissement(true);
              await charger().catch(() => undefined);
              setRafraichissement(false);
            }}
          />
        }
        onScroll={(e) => {
          defilement.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      />
      <BarreTitreCompacte titre="Activité" defilement={defilement} />
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { paddingHorizontal: Espace.xl, paddingBottom: Espace.xxxl },
  entete: { gap: Espace.lg, marginBottom: Espace.sm },
  bilan: { gap: Espace.lg },
  bilanHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  enLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  totaux: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Espace.lg },
  total: { flex: 1, gap: 2 },
  titreSection: { marginTop: Espace.xl, marginBottom: Espace.sm },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: Espace.md, padding: 14 },
  date: { width: 48, alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, paddingRight: 12 },
  jour: { fontSize: 22, lineHeight: 26 },
  moisCourt: { fontSize: 10, letterSpacing: 0.6 },
  milieu: { flex: 1, gap: 3 },
  droite: { alignItems: 'flex-end', gap: 3 },
  chiffres: { fontVariant: ['tabular-nums'] },
  barre: { textDecorationLine: 'line-through' },
  vide: { alignItems: 'center', gap: Espace.sm, paddingVertical: Espace.xxxl },
});
