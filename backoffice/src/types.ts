// Types partagés de la plateforme web BorneApp (alignés sur l'API Laravel).

export type Role =
  | 'client'
  | 'super_admin'
  | 'exploitant'
  | 'operateur'
  | 'technicien'
  | 'service_client'
  | 'finance'

export type Module =
  | 'dashboard'
  | 'supervision'
  | 'bornes'
  | 'sessions'
  | 'utilisateurs'
  | 'rfid'
  | 'vehicules'
  | 'paiements'
  | 'tarification'
  | 'maintenance'
  | 'alertes'
  | 'firmware'
  | 'rapports'
  | 'documents'
  | 'parametres'
  | 'audit'

export type Niveau = 'aucun' | 'lecture' | 'ecriture'

export interface Paginated<T> {
  data: T[]
  meta: { total: number; current_page: number; per_page: number }
}

// --- Authentification ---

export interface User {
  id: number
  nom: string
  prenom: string
  email: string
  telephone: string | null
  role: Role
  soldeWallet: number
  deuxFacteurs?: boolean
  qrToken?: string | null
  permissions?: Record<Module, Niveau>
}

export interface LoginResponse {
  token?: string
  user?: User
  twoFactor?: boolean
}

export interface Plateforme {
  nom: string
  logoUrl: string | null
  devise: string
  langue: 'fr' | 'en' | 'ar'
  fuseauHoraire: string
}

// --- Tableau de bord & supervision ---

export interface Stats {
  bornesTotal: number
  bornesActives: number
  bornesIndisponibles: number
  bornesOccupees: number
  tauxDisponibilite: number
  sessionsAujourdhui: number
  sessionsEnCours: number
  puissanceInstantaneeKw: number
  caTotal: number
  caAujourdhui: number
  caMois: number
  kwhTotal: number
  kwhAujourdhui: number
  tempsMoyenMinutes: number
  alertesOuvertes: number
  alertesCritiques: number
  maintenancesEnCours: number
}

export interface Series {
  jours: { jour: string; sessions: number; kwh: number; ca: number }[]
  parHeure: { heure: number; sessions: number }[]
  parConnecteur: { type: string; sessions: number }[]
}

export interface TopBorne {
  borneId: number
  borneNom: string
  sessions: number
  kwh: number
  ca: number
}

export interface SessionLive {
  id: number
  connecteurId: number
  typeConnecteur: string
  userNom: string
  etat: EtatSession
  dateDebut: string
  energieKwh: number
  puissanceKw: number | null
  pourcentageBatterie: number | null
  prix: number
  tempsRestantMinutes: number | null
}

export interface BorneSupervision {
  id: number
  nom: string
  reference: string
  adresse: string
  latitude: number
  longitude: number
  etat: EtatBorne
  puissanceKw: number
  enLigne: boolean
  websocket: boolean | null
  temperatureC: number | null
  dernierHeartbeat: string | null
  connecteursTotal: number
  connecteursOccupes: number
  alertesOuvertes: number
  connecteurs: { id: number; type: TypeConnecteur; puissanceKw: number; etat: EtatConnecteur }[]
  sessions: SessionLive[]
}

export interface Supervision {
  serveurOcpp: boolean
  horodatage: string
  bornes: BorneSupervision[]
}

// --- Bornes & connecteurs ---

export type EtatBorne =
  | 'disponible'
  | 'occupee'
  | 'hors_service'
  | 'maintenance'
  | 'deconnectee'
  | 'defaut'

export type TypeConnecteur = 'CCS' | 'Type2' | 'CHAdeMO' | 'AC' | 'DC'
export type EtatConnecteur = 'disponible' | 'occupe' | 'reserve' | 'indisponible' | 'defaut'

export interface Connecteur {
  id: number
  borneId: number
  numero?: number
  type: TypeConnecteur
  courant: 'AC' | 'DC'
  puissanceKw: number
  etat: EtatConnecteur
}

export interface Borne {
  id: number
  source?: 'reseau' | 'publique'
  operateur?: string | null
  nom: string
  reference: string
  numeroSerie: string
  modele: string
  fabricant: string
  adresse: string
  site: string | null
  latitude: number
  longitude: number
  versionFirmware: string
  versionOcpp: '1.6' | '2.0.1'
  puissanceKw: number
  etat: EtatBorne
  enLigne: boolean
  dernierHeartbeat: string | null
  temperatureC: number | null
  tarifKwh: number
  tarifId: number | null
  tarifSpecialId: number | null
  tarifLibelle?: string
  exploitantId: number | null
  exploitantNom?: string | null
  technicienId: number | null
  technicienNom?: string | null
  alertesOuvertes?: number
  connecteurs: Connecteur[]
}

export interface BorneInput {
  nom: string
  reference: string
  numeroSerie: string
  modele: string
  fabricant: string
  adresse: string
  site?: string | null
  latitude: number
  longitude: number
  versionFirmware: string
  versionOcpp: '1.6' | '2.0.1'
  puissanceKw: number
  tarifKwh: number
  tarifId?: number | null
  tarifSpecialId?: number | null
  exploitantId?: number | null
  technicienId?: number | null
  etat?: EtatBorne
  connecteurs?: { type: TypeConnecteur; puissanceKw: number }[]
}

export interface BorneDetail {
  borne: Borne
  stats: {
    sessions30j: number
    kwh30j: number
    ca30j: number
    tauxOccupation: number
    maintenances: number
    pannesOuvertes: number
  }
  sessionsEnCours: Session[]
}

export interface EvenementHistorique {
  date: string
  categorie: 'session' | 'alerte' | 'maintenance' | 'firmware' | 'action'
  titre: string
  details: string | null
}

export type CommandeOcpp =
  | 'reset'
  | 'reset_hard'
  | 'unlock'
  | 'change_configuration'
  | 'get_configuration'
  | 'get_diagnostics'
  | 'remote_stop'

// --- Sessions ---

export type EtatSession = 'en_cours' | 'en_pause' | 'terminee' | 'annulee'
export type OrigineSession = 'application' | 'rfid' | 'back_office'

export interface Session {
  id: number
  borneId: number
  borneNom: string
  userId: number
  userNom: string
  connecteurId: number
  typeConnecteur: TypeConnecteur | string
  vehiculeId: number | null
  vehicule: string | null
  origine: OrigineSession
  badgeUid: string | null
  tarifNom: string | null
  dateDebut: string
  dateFin: string | null
  dureeMinutes: number
  energieKwh: number
  prix: number
  etat: EtatSession
  puissanceInstantaneeKw: number | null
  pourcentageBatterie: number | null
  tempsRestantMinutes: number | null
  motifAnnulation: string | null
  paiementStatut?: StatutPaiement | null
  factureId?: number | null
}

export interface Mesure {
  t: string
  energieKwh: number
  puissanceKw: number | null
  pourcentageBatterie: number | null
}

// --- Utilisateurs, RFID, véhicules ---

export interface AdminUser {
  id: number
  nom: string
  prenom: string
  email: string
  telephone: string | null
  role: Role
  actif: boolean
  soldeWallet: number
  deuxFacteurs: boolean
  qrToken: string | null
  derniereConnexion: string | null
  createdAt: string
  nbSessions?: number
  nbVehicules?: number
  nbBadges?: number
}

export interface UserOption {
  id: number
  nom: string
  email: string
  role: Role
}

export interface UserDetail {
  user: AdminUser
  stats: { sessions: number; kwh: number; depenses: number; impayes: number }
  souscription: Souscription | null
  souscriptions: Souscription[]
  vehicules: Vehicule[]
  badges: Badge[]
  sessions: Session[]
  paiements: Paiement[]
}

export interface EntreeHistorique {
  id: number
  auteur: string
  action: string
  cible: string | null
  details: string | null
  ip: string | null
  date: string
}

export type StatutBadge = 'actif' | 'inactif' | 'bloque' | 'expire' | 'non_associe'

export interface Badge {
  id: number
  uid: string
  libelle: string | null
  userId: number | null
  userNom: string | null
  actif: boolean
  bloque: boolean
  motifBlocage: string | null
  dateExpiration: string | null
  statut: StatutBadge
  derniereUtilisation: string | null
  createdAt: string
}

export interface EvenementBadge {
  id: number
  evenement: string
  details: string | null
  acteur: string
  borneNom: string | null
  date: string
}

export interface Vehicule {
  id: number
  userId: number
  userNom: string | null
  marque: string
  modele: string
  immatriculation: string
  typeConnecteur: TypeConnecteur
  capaciteBatterieKwh: number
  nbSessions?: number
  energieTotaleKwh?: number
}

// --- Paiements & facturation ---

export type StatutPaiement = 'paye' | 'en_attente' | 'rembourse' | 'rembourse_partiel' | 'echoue'

export interface Paiement {
  id: number
  userId: number
  userNom?: string | null
  sessionId: number | null
  souscriptionId: number | null
  objet: string
  montant: number
  montantRembourse: number
  methode: string
  statut: StatutPaiement
  referencePsp: string | null
  motifRemboursement: string | null
  rembourseLe: string | null
  regleLe: string | null
  date: string
}

export interface ResumePaiements {
  encaisse: number
  enAttente: number
  nbEnAttente: number
  rembourse: number
  parMethode: { methode: string; nombre: number; total: number }[]
}

export interface Facture {
  id: number
  sessionId: number
  numero: string
  date: string
  montantHt: number | null
  tauxTva: number | null
  montantTva: number | null
  montantTtc: number
  statut: 'emise' | 'payee' | 'remboursee'
  userId: number
  userNom?: string | null
}

// --- Tarification ---

export type ModeTarif = 'kwh' | 'minute' | 'heure' | 'puissance'

export interface Tarif {
  id: number
  nom: string
  mode: ModeTarif
  prix: number
  prixHeuresCreuses: number | null
  heuresCreusesDebut: string | null
  heuresCreusesFin: string | null
  fraisSession: number
  special: boolean
  valideDu: string | null
  valideAu: string | null
  actif: boolean
  description: string | null
  nbBornes?: number
}

export interface Abonnement {
  id: number
  nom: string
  description: string | null
  prixMensuel: number
  remisePourcent: number
  kwhInclus: number
  actif: boolean
  nbAbonnes?: number
}

export interface Souscription {
  id: number
  userId: number
  userNom?: string | null
  abonnementId: number
  abonnementNom: string
  remisePourcent: number
  kwhInclus: number
  prixMensuel: number
  dateDebut: string
  dateFin: string
  statut: 'active' | 'expiree' | 'resiliee'
  renouvellementAuto: boolean
}

// --- Maintenance ---

export type StatutMaintenance = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'
export type PrioriteMaintenance = 'basse' | 'normale' | 'haute' | 'urgente'

export interface Maintenance {
  id: number
  reference: string
  borneId: number
  borneNom: string
  panneId: number | null
  technicienId: number | null
  technicienNom: string | null
  type: 'preventive' | 'corrective'
  priorite: PrioriteMaintenance
  titre: string | null
  statut: StatutMaintenance
  description: string
  datePrevue: string | null
  dateDebut: string | null
  dateFin: string | null
  rapport: string | null
  periodiciteJours: number | null
  coutPieces?: number
  pieces?: { id: number; designation: string; reference: string | null; quantite: number; coutUnitaire: number }[]
  interventions?: { id: number; technicienNom: string | null; debut: string; fin: string | null; description: string }[]
  commentaires?: { id: number; auteur: string; contenu: string; date: string }[]
  photos?: DocumentItem[]
  createdAt: string
}

export interface MaintenanceInput {
  borneId: number
  panneId?: number | null
  technicienId?: number | null
  type: 'preventive' | 'corrective'
  priorite?: PrioriteMaintenance
  titre?: string | null
  description: string
  datePrevue?: string | null
  statut?: StatutMaintenance
  rapport?: string | null
  periodiciteJours?: number | null
}

export type StatutPanne = 'ouverte' | 'en_cours' | 'resolue'
export type GravitePanne = 'faible' | 'moyenne' | 'elevee' | 'critique'

export interface Panne {
  id: number
  borneId: number
  borneNom: string
  connecteurId: number | null
  alerteId: number | null
  type: string
  gravite: GravitePanne
  description: string
  statut: StatutPanne
  signaleParNom: string | null
  resolueLe: string | null
  ordresTravail?: { id: number; reference: string; statut: StatutMaintenance }[]
  createdAt: string
}

// --- Alertes ---

export type GraviteAlerte = 'info' | 'warning' | 'critique'

export interface Alerte {
  id: number
  borneId: number
  borneNom: string
  type: string
  gravite: GraviteAlerte
  message: string
  resolue: boolean
  resolueLe: string | null
  resolueParNom: string | null
  priseEnChargeParNom: string | null
  nbNotifications?: number
  createdAt: string
}

export interface NotificationEnvoyee {
  id: number
  alerteId: number | null
  canal: 'email' | 'sms' | 'push'
  destinataire: string
  sujet: string
  statut: 'envoyee' | 'echec' | 'desactive'
  erreur: string | null
  date: string
}

// --- Firmware ---

export interface Firmware {
  id: number
  version: string
  fabricant: string | null
  modele: string | null
  nomFichier: string
  taille: number
  checksum: string
  notes: string | null
  auteur: string | null
  nbDeploiements?: number
  createdAt: string
}

export type StatutDeploiement = 'en_attente' | 'telechargement' | 'telecharge' | 'installation' | 'installe' | 'echec'

export interface Deploiement {
  id: number
  firmwareId: number
  version: string
  borneId: number
  borneNom: string
  versionPrecedente: string | null
  statut: StatutDeploiement
  rollback: boolean
  message: string | null
  lanceParNom: string | null
  createdAt: string
  updatedAt: string
}

// --- Rapports ---

export type TypeRapport =
  | 'consommation'
  | 'chiffre_affaires'
  | 'utilisation'
  | 'disponibilite'
  | 'top_bornes'
  | 'top_clients'
  | 'maintenance'

export interface Rapport {
  type: TypeRapport
  titre: string
  periode: { debut: string; fin: string }
  devise: string
  colonnes: Record<string, string>
  lignes: Record<string, string | number>[]
  totaux: Record<string, number>
}

// --- Documents ---

export type TypeDocument = 'notice' | 'photo' | 'contrat' | 'plan' | 'garantie' | 'diagnostic' | 'autre'

export interface DocumentItem {
  id: number
  borneId: number | null
  borneNom: string | null
  maintenanceId: number | null
  type: TypeDocument
  titre: string
  nomFichier: string
  mime: string | null
  taille: number
  dateExpiration: string | null
  auteur: string | null
  createdAt: string
}

// --- Paramétrage ---

export interface Parametres {
  plateforme_nom: string
  logo: string | null
  logoUrl: string | null
  devise: string
  tva_taux: number
  fuseau_horaire: string
  langue: 'fr' | 'en' | 'ar'
  mentions_facture: string | null
  email_expediteur: string
  email_alertes_destinataires: string[]
  sms_actif: boolean
  sms_fournisseur: string
  sms_expediteur: string
  sms_api_key: string | null
  sms_destinataires: string[]
  push_actif: boolean
  notifications_regles: Record<GraviteAlerte, ('email' | 'sms' | 'push')[]>
  seuil_temperature: number
  delai_heartbeat_minutes: number
  deux_facteurs_personnel: boolean
}

export interface MatricePermissions {
  modules: Record<Module, string>
  roles: Role[]
  matrice: Record<Role, Record<Module, Niveau>>
}

// --- Audit ---

export interface AuditEntry {
  id: number
  userId: number | null
  userNom: string
  action: string
  cible: string | null
  details: string | null
  ip: string | null
  createdAt: string
}

export interface PageAudit extends Paginated<AuditEntry> {
  actions: string[]
}

// --- Espace client ---

export interface StatsClient {
  parMois: { mois: string; kwh: number; prix: number; sessions: number }[]
  kmAjoutes: number
  sessionsTotal: number
  energieTotaleKwh: number
  depensesTotal: number
  dureeMoyenneMinutes: number
}

export interface SessionClient {
  id: number
  borneId: number
  borneNom: string
  connecteurId: number
  typeConnecteur: string
  vehiculeId: number | null
  dateDebut: string
  dateFin: string | null
  dureeMinutes: number | null
  energieKwh: number
  prix: number
  etat: EtatSession
  puissanceInstantaneeKw: number | null
  pourcentageBatterie: number | null
}

export interface FactureClient {
  id: number
  sessionId: number
  numero: string
  date: string
  montantTtc: number
  statut: 'emise' | 'payee' | 'remboursee'
}
