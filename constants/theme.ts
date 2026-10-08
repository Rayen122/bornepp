/**
 * Système visuel BorneApp — thème sombre anthracite et rouge carmin (identique au site web).
 * - « primary » / « electric » / « energy » : rouge vif pour le texte, les icônes et le décor (5:1).
 * - « action » : rouge des fonds pleins à texte blanc, boutons en tête (5,5:1).
 * - « ink » : noir profond des en-têtes et des cartes mises en avant.
 * - « copper » : prix et wallet.
 * L'app est sombre dans les deux modes du système : même palette pour « light » et « dark ».
 */

const SOMBRE = {
  background: '#121215',
  surface: '#1B1B20',
  surfaceAlt: '#24242A',
  text: '#F5F5F7',
  textMuted: '#A1A1AA',
  textFaint: '#8E8E99',
  border: '#2E2E36',

  /** Rouge vif pour le texte, les icônes, les bordures et les jauges (5:1 sur le fond). */
  primary: '#F04257',
  primaryPressed: '#D63349',
  /** Rouge des fonds pleins portant du texte blanc : boutons, puces sélectionnées (5,5:1). */
  action: '#D0142C',
  actionPressed: '#B8102A',
  primarySoft: '#2A1519',
  onPrimary: '#FFFFFF',
  energy: '#F04257',

  ink: '#0D0D10',
  inkRaised: '#1E1E24',
  onInk: '#F5F5F7',
  onInkMuted: '#A1A1AA',
  electric: '#F04257',

  copper: '#F0955A',
  copperSoft: '#2C1A0F',

  success: '#22C55E',
  warning: '#F5B83D',
  danger: '#FF6B6B',
  info: '#60A5FA',
  neutral: '#8E8E99',

  // Compatibilité avec les composants du template Expo
  tint: '#F04257',
  icon: '#A1A1AA',
  muted: '#A1A1AA',
  card: '#1B1B20',
  tabIconDefault: '#8E8E99',
  tabIconSelected: '#F04257',
};

export const Colors = {
  light: SOMBRE,
  dark: SOMBRE,
};

export type Palette = (typeof Colors)['light'];
export type CouleurSemantique = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

/** Familles chargées dans app/_layout.tsx. Pas de fontWeight avec ces polices (Android l'ignore). */
export const Polices = {
  display: 'Outfit_700Bold',
  displayHeavy: 'Outfit_800ExtraBold',
  displaySemi: 'Outfit_600SemiBold',
  body: 'DMSans_500Medium',
  bodyRegular: 'DMSans_400Regular',
  bodySemi: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
};

export const Rayons = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const Espace = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const EtatBorneCouleurs: Record<string, { label: string; couleur: CouleurSemantique }> = {
  disponible: { label: 'Disponible', couleur: 'success' },
  occupee: { label: 'En charge', couleur: 'info' },
  hors_service: { label: 'Hors service', couleur: 'danger' },
  maintenance: { label: 'Maintenance', couleur: 'warning' },
  deconnectee: { label: 'Hors ligne', couleur: 'neutral' },
  defaut: { label: 'En défaut', couleur: 'danger' },
  inconnu: { label: 'Borne publique', couleur: 'neutral' },
};
