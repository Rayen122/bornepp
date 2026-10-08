# BorneApp 📱⚡

Plateforme complète de gestion de bornes de recharge électrique connectées :

| Dossier | Composant | Techno |
|---|---|---|
| [backoffice/](backoffice/) | **Plateforme web** (back-office + espace client) | React 18, TypeScript, Ant Design 5, Axios, React Query, ECharts, Leaflet/OSM |
| [backend/](backend/) | **API REST** | Laravel 13, PHP 8.3+, Sanctum, MySQL 8 / MariaDB, files d'attente, planificateur |
| [ocpp-server/](ocpp-server/) | **Serveur OCPP 1.6J** + relais temps réel + simulateur de borne | Node.js, WebSocket |
| racine | **App mobile client** (iOS / Android) | React Native, Expo SDK 54, expo-router |

```
Bornes ──OCPP 1.6J (WebSocket :9220)──▶ Serveur OCPP ──HTTP──▶ API Laravel ──▶ MySQL
                                           │  ▲                    │
                                           │  └── commandes :9221 ─┘
                                           └── temps réel :9222 (WebSocket) ──▶ Plateforme web React
```

## Lancement

```bash
# 0. Base de données (une fois) : base MySQL « borneapp », identifiants dans backend/.env
cd backend && php artisan migrate:fresh --seed && php artisan storage:link

# 1. API Laravel (port 8000)
cd backend && php artisan serve

# 2. File d'attente (notifications email / SMS / push des alertes)
cd backend && php artisan queue:work

# 3. Planificateur (heartbeats, abonnements, rappels de maintenance)
cd backend && php artisan schedule:work

# 4. Serveur OCPP (9220 bornes / 9221 commandes / 9222 temps réel)
cd ocpp-server && npm start
#    + bornes simulées (tapez « aide » dans le terminal pour les scénarios)
cd ocpp-server && npm run simulate BRN-TUN-001 BRN-BIZ-001

# 5. Plateforme web (http://localhost:5173)
cd backoffice && npm run dev

# 6. App mobile (dev build : npx expo run:ios / run:android ; ou version web : npx expo start --web)
npx expo start
```

Sur un téléphone physique, l'app appelle l'API sur l'adresse IP de la machine de développement :
lancer alors l'API avec `php artisan serve --host=0.0.0.0` (elle devient joignable sur le réseau local).

Le simulateur accepte au clavier : `badge <UID>` (recharge au badge RFID), `stop`, `chaud` (surchauffe),
`porte` (trappe ouverte), `panne` (défaut matériel), `coupure` (sous-tension), `ok` (retour à la normale).
Il répond aussi aux commandes OCPP envoyées depuis la plateforme (reset, déverrouillage, configuration,
diagnostics, mise à jour firmware avec téléchargement réel du binaire, pause / reprise de charge).

## Comptes de démonstration (mot de passe : `password`)

| Rôle | Email |
|---|---|
| Super administrateur | `admin@borneapp.tn` |
| Exploitant | `exploitant@borneapp.tn` |
| Opérateur | `operateur@borneapp.tn` |
| Technicien | `technicien@borneapp.tn`, `technicien2@borneapp.tn` |
| Service client | `support@borneapp.tn` |
| Finance | `finance@borneapp.tn` |
| Client (web + mobile) | `rzprodtn@gmail.com` (abonnement Confort, badge `A4:5F:22:9C`) |

Le personnel arrive sur le back-office, les clients sur l'espace client : la même application web
affiche les menus selon la matrice des droits.

## App mobile (client)

Expo SDK 54 / React Native, même API que la plateforme web :

- **Recharger** : carte et liste des bornes (réseau + bornes publiques), fiche borne avec tarif réel
  (kWh / minute / heure / puissance, heures creuses, frais, tarif promo) et estimation de prix incluant
  la remise d'abonnement, réservation 15 min, démarrage / arrêt OCPP, suivi en direct (puissance,
  batterie, coût, courbe), état « en pause » piloté par le back-office.
- **QR code des bornes** : le QR affiché sur la fiche borne du back-office (`borneapp://borne/BRN-TUN-001`)
  ouvre directement la fiche dans l'app.
- **Compte** : wallet, abonnement (souscription wallet / carte, résiliation), véhicules (ajout,
  modification, suppression), badges RFID (déclaration de perte / vol), paiements et factures PDF,
  paiements différés à régler (wallet ou carte), profil, mot de passe, double authentification,
  QR code d'identification.
- **Activité** : historique, détail avec courbe de puissance et statut de paiement.

### Générer l'APK Android

```bash
npx expo prebuild --platform android --no-install
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ANDROID_HOME="$HOME/Library/Android/sdk" EXPO_PUBLIC_API_URL="http://<IP-du-Mac>:8000/api/v1" \
  ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
# → android/app/build/outputs/apk/release/app-release.apk
```

L'APK appelle l'API à l'adresse fixée au build (`EXPO_PUBLIC_API_URL`) ; si l'IP du Mac change,
reconstruire l'APK avec la nouvelle adresse. L'API doit tourner avec
`php artisan serve --host=0.0.0.0` et le téléphone être sur le même réseau Wi-Fi.
Le trafic HTTP en clair est autorisé (`usesCleartextTraffic`) pour cette démo : en production,
servir l'API en HTTPS et retirer cette option de `app.json`.

## Couverture du cahier des charges

| Module | Plateforme web | API / serveur |
|---|---|---|
| 1. Authentification | Connexion, déconnexion, 2FA par email (obligatoire pour le personnel en option), mot de passe oublié, inscription client | Sanctum, 7 rôles, comptes désactivables, journal des connexions |
| 2. Bornes | Liste, création / modification avec géolocalisation sur carte, désactivation / réactivation, affectation (exploitant, technicien, site), fiche détaillée, historique, QR code | `/admin/bornes` |
| 3. Connecteurs | CCS, Type2, CHAdeMO, AC, DC ; puissance, état, disponibilité ; ajout / modification / mise hors service | États par connecteur via StatusNotification |
| 4. Supervision temps réel | Carte interactive, liste, état, occupation, température, connexion, dernier heartbeat, temps restant, alertes, mises à jour automatiques (WebSocket) | Relais temps réel du serveur OCPP |
| 5. Sessions | Création, début, pause, reprise, fin, annulation ; courbe de charge | Pause = `SetChargingProfile` 0 kW, reprise = `ClearChargingProfile` |
| 6. Utilisateurs | Clients, techniciens, exploitants, administrateurs ; historique, abonnements, badges, QR code, ajustement wallet | |
| 7. RFID | Association, activation, blocage, expiration, historique | `Authorize` / `StartTransaction` au badge |
| 8. Véhicules | Marque, modèle, immatriculation, connecteur, batterie, historique des recharges | |
| 9. Paiement | Carte (sandbox PSP), wallet, abonnement, paiement différé, factures PDF (HT/TVA/TTC), historique, remboursements | |
| 10. Tarification | Par kWh / minute / heure / puissance, heures pleines / creuses, frais de session, tarifs spéciaux datés, simulateur | Prix calculé en direct et en fin de session, kWh inclus et remise d'abonnement |
| 11. Maintenance | Planning (calendrier), ordres de travail, pannes, pièces remplacées, interventions, commentaires, photos, préventif récurrent | Rappels quotidiens |
| 12. Alertes | Borne déconnectée, défaut matériel, surchauffe, coupure électrique, porte ouverte, erreur OCPP ; notifications email / SMS / push | Job en file d'attente, règles par gravité |
| 13. Firmware | Téléversement (SHA-256), déploiement multi-bornes, historique, versions, rollback | `UpdateFirmware` (URL signée) + `FirmwareStatusNotification` |
| 14. Rapports | Consommation, CA, utilisation, disponibilité, top bornes, top clients, maintenance ; export PDF, Excel, CSV | |
| 15. Tableau de bord | KPIs, bornes actives / indisponibles, sessions du jour, CA, kWh, temps moyen, carte temps réel | |
| 16. Documents | Notices, photos, contrats, plans, garanties (échéances), diagnostics OCPP | `GetDiagnostics` (dépôt par URL signée) |
| 17. Paramétrage | Système, TVA, logo, emails, SMS, push, fuseau horaire, langue, seuils de supervision | |
| 18. Audit | Connexions, modifications (avant → après), suppressions, exports ; filtres et export | Traçabilité automatique des modèles |
| §6 OCPP | Commandes depuis la fiche borne | BootNotification, Heartbeat, Authorize, Start/StopTransaction, MeterValues, StatusNotification, Remote Start/Stop, ChangeConfiguration, GetConfiguration, UpdateFirmware, Reset, UnlockConnector, GetDiagnostics, Diagnostics/FirmwareStatusNotification |
| §7 Droits | Matrice éditable par le super administrateur (aucun / lecture / écriture par module et par rôle) | Middleware `permission:module` |

## Tests

```bash
cd backend && ./vendor/bin/pest    # 54 tests : auth, RBAC, sessions, tarification, paiements, RFID, OCPP, firmware, maintenance, rapports, audit
cd backoffice && npm run build     # plateforme web (typecheck + build)
npx tsc --noEmit                   # app mobile
```

## Notes

- Les codes 2FA / réinitialisation et les emails d'alerte partent dans `backend/storage/logs/laravel.log`
  (`MAIL_MAILER=log`). Brancher un vrai SMTP en production.
- SMS : le fournisseur « log » écrit dans les logs ; brancher l'API retenue dans `App\Services\Notifications::sms()`.
- Paiement carte en mode **sandbox** (crédit immédiat, aucune donnée de carte saisie) : brancher un PSP
  (Konnect / Paymee) dans `WalletController` avec redirection vers sa page de paiement.
- Bornes publiques réelles (consultation seule) : `php artisan bornes:importer-publiques`.
- Pour revenir aux données de démonstration embarquées sans backend dans l'app mobile : `USE_MOCK = true`
  dans [lib/api.ts](lib/api.ts).
