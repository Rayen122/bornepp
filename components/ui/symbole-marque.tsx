import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Symbole de la marque : éclair vert électrique sur tuile encre (identique au site et au favicon). */
export function SymboleMarque({ taille = 32 }: { taille?: number }) {
  return (
    // Décoratif : masqué aux lecteurs d'écran (aria-hidden fonctionne en natif comme sur le web).
    <View aria-hidden>
      <Svg width={taille} height={taille} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="symbole-fond" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2A2A31" />
            <Stop offset="1" stopColor="#0D0D10" />
          </LinearGradient>
        </Defs>
        <Rect width="32" height="32" rx="9" fill="url(#symbole-fond)" />
        <Rect x="0.5" y="0.5" width="31" height="31" rx="8.5" stroke="rgba(255,255,255,0.14)" fill="none" />
        <Path d="M17.6 5.5 9 18h6.2l-1.4 8.5L22.6 14h-6.3l1.3-8.5Z" fill="#F04257" />
      </Svg>
    </View>
  );
}
