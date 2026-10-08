import { usePlateforme } from '../hooks/usePlateforme'

/** Symbole de la marque : éclair vert électrique sur tuile encre (identique au favicon). */
export function SymboleMarque({ taille = 32 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 32 32" fill="none" aria-hidden className="symbole-marque">
      <defs>
        <linearGradient id="symbole-fond" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A2A31" />
          <stop offset="1" stopColor="#0D0D10" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#symbole-fond)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" stroke="rgba(255,255,255,.12)" />
      <path d="M17.6 5.5 9 18h6.2l-1.4 8.5L22.6 14h-6.3l1.3-8.5Z" fill="#F04257" />
    </svg>
  )
}

/** Logo complet : logo téléversé (module 17) ou symbole + nom de la plateforme. */
export default function Marque({ replie = false, clair = false }: { replie?: boolean; clair?: boolean }) {
  const plateforme = usePlateforme()
  return (
    <span className={`marque-contenu${clair ? ' marque-contenu-clair' : ''}`}>
      {plateforme.logoUrl ? <img src={plateforme.logoUrl} alt={plateforme.nom} /> : <SymboleMarque />}
      {!replie && !plateforme.logoUrl && <span className="marque-nom">{plateforme.nom}</span>}
    </span>
  )
}
