<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\Alerte;
use App\Models\BadgeRfid;
use App\Models\Borne;
use App\Models\DeploiementFirmware;
use App\Models\Document;
use App\Models\MesureRecharge;
use App\Models\Parametre;
use App\Models\SessionRecharge;
use App\Services\GestionSessions;
use App\Services\OcppClient;
use App\Services\Tarification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Réception des événements OCPP relayés par le serveur OCPP (ocpp-server/).
 * Routes protégées par le secret partagé (middleware ocpp.secret).
 */
class OcppEventController extends Controller
{
    /** Statuts OCPP 1.6 d'un connecteur → état métier du connecteur. */
    private const STATUTS_CONNECTEUR = [
        'Available' => 'disponible',
        'Preparing' => 'occupe',
        'Charging' => 'occupe',
        'SuspendedEV' => 'occupe',
        'SuspendedEVSE' => 'occupe',
        'Finishing' => 'occupe',
        'Reserved' => 'reserve',
        'Unavailable' => 'indisponible',
        'Faulted' => 'defaut',
    ];

    /** ChargePointErrorCode OCPP 1.6 → type d'alerte (module 12). */
    private const ERREURS = [
        'HighTemperature' => ['surchauffe', 'critique'],
        'PowerSwitchFailure' => ['coupure_electrique', 'critique'],
        'UnderVoltage' => ['coupure_electrique', 'critique'],
        'OverVoltage' => ['coupure_electrique', 'critique'],
        'OverCurrentFailure' => ['defaut_materiel', 'critique'],
        'GroundFailure' => ['defaut_materiel', 'critique'],
        'ConnectorLockFailure' => ['defaut_materiel', 'warning'],
        'EVCommunicationError' => ['defaut_materiel', 'warning'],
        'PowerMeterFailure' => ['defaut_materiel', 'warning'],
        'ReaderFailure' => ['defaut_materiel', 'warning'],
        'InternalError' => ['erreur_ocpp', 'warning'],
        'LocalListConflict' => ['erreur_ocpp', 'info'],
        'WeakSignal' => ['erreur_ocpp', 'info'],
    ];

    public function __construct(
        private readonly GestionSessions $sessions,
        private readonly Tarification $tarification,
    ) {}

    /** BootNotification : la borne se connecte. */
    public function boot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string'],
            'versionFirmware' => ['nullable', 'string'],
            'modele' => ['nullable', 'string'],
            'fabricant' => ['nullable', 'string'],
            'numeroSerie' => ['nullable', 'string'],
        ]);

        $borne = Borne::where('reference', $data['reference'])->first();
        if (! $borne) {
            return response()->json(['message' => 'Borne inconnue', 'status' => 'Rejected'], 404);
        }

        $borne->update(array_filter([
            'etat' => $borne->etat === 'deconnectee' ? 'disponible' : $borne->etat,
            'dernier_heartbeat' => now(),
            'version_firmware' => $data['versionFirmware'] ?? null,
        ]));

        $borne->alertes()->where('type', 'borne_deconnectee')->where('resolue', false)
            ->update(['resolue' => true, 'resolue_le' => now()]);

        return response()->json(['message' => 'Accepted', 'status' => 'Accepted', 'interval' => 30]);
    }

    /** Heartbeat périodique. */
    public function heartbeat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string'],
            'temperatureC' => ['nullable', 'numeric'],
        ]);

        $borne = Borne::where('reference', $data['reference'])->firstOrFail();
        $misAJour = ['dernier_heartbeat' => now()];

        if (isset($data['temperatureC'])) {
            $misAJour['temperature_c'] = $data['temperatureC'];

            // Alerte automatique de surchauffe (module 12), seuil paramétrable.
            if ($data['temperatureC'] >= (float) Parametre::get('seuil_temperature', 60)) {
                Alerte::lever($borne, 'surchauffe', 'critique', "Température de {$data['temperatureC']} °C sur {$borne->nom}");
            }
        }

        if ($borne->etat === 'deconnectee') {
            $misAJour['etat'] = 'disponible';
            $borne->alertes()->where('type', 'borne_deconnectee')->where('resolue', false)
                ->update(['resolue' => true, 'resolue_le' => now()]);
        }

        $borne->update($misAJour);

        return response()->json(['message' => 'OK']);
    }

    /**
     * StatusNotification : état d'un connecteur (connectorId ≥ 1) ou de la
     * borne entière (connectorId 0), avec code d'erreur éventuel.
     */
    public function status(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string'],
            'etat' => ['nullable', 'in:disponible,occupee,hors_service,maintenance,deconnectee,defaut'],
            'connectorId' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'string'],
            'errorCode' => ['nullable', 'string'],
            'vendorErrorCode' => ['nullable', 'string'],
            'info' => ['nullable', 'string'],
        ]);

        $borne = Borne::where('reference', $data['reference'])->firstOrFail();
        $borne->dernier_heartbeat = now();

        $this->leverAlerteErreur($borne, $data);

        $connecteur = isset($data['connectorId']) ? OcppClient::connecteurParNumero($borne, $data['connectorId']) : null;
        $etatConnecteur = self::STATUTS_CONNECTEUR[$data['status'] ?? ''] ?? null;

        if ($connecteur && $etatConnecteur) {
            $connecteur->update(['etat' => $etatConnecteur]);
            if (! in_array($borne->etat, ['maintenance', 'hors_service'], true)) {
                $borne->etat = $this->etatDepuisConnecteurs($borne);
            }
        } elseif (isset($data['etat'])) {
            // Compatibilité : état global transmis directement.
            $borne->etat = $data['etat'];
        } elseif ($etatConnecteur && ! in_array($borne->etat, ['maintenance', 'hors_service'], true)) {
            $borne->etat = ['disponible' => 'disponible', 'occupe' => 'occupee', 'reserve' => 'disponible', 'indisponible' => 'hors_service', 'defaut' => 'defaut'][$etatConnecteur];
        }

        $borne->save();

        if ($borne->etat === 'defaut') {
            Alerte::lever($borne, 'defaut_materiel', 'critique', "Défaut matériel signalé par {$borne->nom}"
                .(isset($data['errorCode']) && $data['errorCode'] !== 'NoError' ? " ({$data['errorCode']})" : ''));
        }

        return response()->json(['message' => 'OK']);
    }

    /** Authorize : contrôle d'un badge RFID présenté à la borne (module 7). */
    public function autoriser(Request $request): JsonResponse
    {
        $data = $request->validate(['reference' => ['required', 'string'], 'idTag' => ['required', 'string']]);

        $borne = Borne::where('reference', $data['reference'])->first();
        $badge = BadgeRfid::with('user')->where('uid', $data['idTag'])->first();
        $statut = $badge?->statutOcpp() ?? 'Invalid';

        if ($badge) {
            $badge->journaliser($statut === 'Accepted' ? 'autorisation_acceptee' : 'autorisation_refusee', $statut, $borne?->id);
            if ($statut === 'Accepted') {
                $badge->update(['derniere_utilisation' => now()]);
            }
        }

        return response()->json(['status' => $statut]);
    }

    /**
     * StartTransaction : soit la suite d'un RemoteStart (idTag = id de session),
     * soit une recharge lancée à la borne avec un badge RFID.
     */
    public function startTransaction(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string'],
            'connectorId' => ['required', 'integer', 'min:1'],
            'idTag' => ['required', 'string'],
        ]);

        $borne = Borne::where('reference', $data['reference'])->firstOrFail();

        if (ctype_digit($data['idTag'])) {
            $session = SessionRecharge::where('id', $data['idTag'])->where('borne_id', $borne->id)
                ->whereIn('etat', SessionRecharge::ETATS_ACTIFS)->first();
            if ($session) {
                $session->update(['transaction_ocpp_id' => (string) $session->id]);

                return response()->json(['sessionId' => $session->id, 'status' => 'Accepted']);
            }
        }

        $badge = BadgeRfid::with('user')->where('uid', $data['idTag'])->first();
        $statut = $badge?->statutOcpp() ?? 'Invalid';
        $connecteur = OcppClient::connecteurParNumero($borne, $data['connectorId']);

        if ($statut !== 'Accepted' || ! $connecteur) {
            return response()->json(['sessionId' => null, 'status' => $connecteur ? $statut : 'Invalid']);
        }

        try {
            $session = $this->sessions->demarrer($badge->user, $borne->id, $connecteur->id, null, 'rfid', $badge, commanderBorne: false);
        } catch (ValidationException $e) {
            return response()->json(['sessionId' => null, 'status' => 'ConcurrentTx', 'message' => collect($e->errors())->flatten()->first()]);
        }

        $session->update(['transaction_ocpp_id' => (string) $session->id]);
        $badge->update(['derniere_utilisation' => now()]);
        $badge->journaliser('recharge_demarree', 'Session #'.$session->id, $borne->id);

        return response()->json(['sessionId' => $session->id, 'status' => 'Accepted']);
    }

    /** MeterValues : télémétrie de la session en cours. */
    public function meterValues(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sessionId' => ['required', 'integer'],
            'energieKwh' => ['required', 'numeric', 'min:0'],
            'puissanceKw' => ['nullable', 'numeric', 'min:0'],
            'pourcentageBatterie' => ['nullable', 'integer', 'between:0,100'],
        ]);

        $session = SessionRecharge::with(['borne', 'connecteur', 'tarif', 'user'])->find($data['sessionId']);
        if (! $session || ! $session->estActive()) {
            return response()->json(['message' => 'Session inconnue ou terminée'], 404);
        }

        $session->energie_kwh = $data['energieKwh'];
        $session->puissance_instantanee_kw = $session->etat === 'en_pause' ? 0 : ($data['puissanceKw'] ?? null);
        $session->pourcentage_batterie = $data['pourcentageBatterie'] ?? $session->pourcentage_batterie;
        $session->prix = $this->tarification->calculer($session);
        $session->save();

        MesureRecharge::create([
            'session_recharge_id' => $session->id,
            'horodatage' => now(),
            'energie_kwh' => $data['energieKwh'],
            'puissance_kw' => $data['puissanceKw'] ?? null,
            'pourcentage_batterie' => $data['pourcentageBatterie'] ?? null,
        ]);

        return response()->json(['message' => 'OK']);
    }

    /** StopTransaction émis par la borne elle-même (fin côté borne, badge, câble débranché). */
    public function stopTransaction(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sessionId' => ['required', 'integer'],
            'energieKwh' => ['nullable', 'numeric', 'min:0'],
        ]);

        $session = SessionRecharge::with(['borne', 'connecteur'])->find($data['sessionId']);
        if (! $session || ! $session->estActive()) {
            return response()->json(['message' => 'Session inconnue ou déjà terminée'], 404);
        }

        $this->sessions->terminer($session, isset($data['energieKwh']) ? (float) $data['energieKwh'] : null, commanderBorne: false);

        return response()->json(['message' => 'OK']);
    }

    /** FirmwareStatusNotification : progression d'une mise à jour (module 13). */
    public function firmwareStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string'],
            'status' => ['required', 'string'],
        ]);

        $borne = Borne::where('reference', $data['reference'])->firstOrFail();
        $deploiement = DeploiementFirmware::with('firmware')
            ->where('borne_id', $borne->id)
            ->whereIn('statut', DeploiementFirmware::STATUTS_EN_COURS)
            ->latest()
            ->first();

        if (! $deploiement) {
            return response()->json(['message' => 'Aucun déploiement en cours'], 404);
        }

        $statut = [
            'Downloading' => 'telechargement',
            'Downloaded' => 'telecharge',
            'Installing' => 'installation',
            'Installed' => 'installe',
            'DownloadFailed' => 'echec',
            'InstallationFailed' => 'echec',
        ][$data['status']] ?? $deploiement->statut;

        $deploiement->update([
            'statut' => $statut,
            'message' => "Borne : {$data['status']}",
        ]);

        if ($statut === 'installe') {
            $borne->update(['version_firmware' => $deploiement->firmware->version]);
        } elseif ($statut === 'echec') {
            Alerte::lever($borne, 'erreur_ocpp', 'warning', "Échec de la mise à jour firmware {$deploiement->firmware->version} sur {$borne->nom}");
        }

        return response()->json(['message' => 'OK']);
    }

    /** DiagnosticsStatusNotification : suivi de l'envoi du fichier de diagnostic. */
    public function diagnosticsStatus(Request $request): JsonResponse
    {
        $data = $request->validate(['reference' => ['required', 'string'], 'status' => ['required', 'string']]);

        if ($data['status'] === 'UploadFailed') {
            $borne = Borne::where('reference', $data['reference'])->firstOrFail();
            Alerte::lever($borne, 'erreur_ocpp', 'info', "Échec de l'envoi des diagnostics de {$borne->nom}");
        }

        return response()->json(['message' => 'OK']);
    }

    /** Dépôt du fichier de diagnostic par la borne (URL signée transmise dans GetDiagnostics). */
    public function diagnosticsUpload(Request $request, Borne $borne): JsonResponse
    {
        $contenu = $request->hasFile('file') ? $request->file('file')->get() : $request->getContent();
        abort_if($contenu === '', 422, 'Fichier vide.');

        $nom = "diagnostic-{$borne->reference}-".now()->format('Ymd-His').'.log';
        $chemin = "documents/{$borne->id}/{$nom}";
        Storage::put($chemin, $contenu);

        Document::create([
            'borne_id' => $borne->id,
            'type' => 'diagnostic',
            'titre' => 'Diagnostic du '.now()->setTimezone(Parametre::get('fuseau_horaire', 'UTC'))->format('d/m/Y H:i'),
            'fichier' => $chemin,
            'nom_fichier' => $nom,
            'mime' => 'text/plain',
            'taille' => strlen($contenu),
        ]);

        return response()->json(['message' => 'Diagnostic reçu']);
    }

    /** Erreur protocolaire remontée par le serveur OCPP (CALLERROR, trame invalide…). */
    public function erreur(Request $request): JsonResponse
    {
        $data = $request->validate(['reference' => ['required', 'string'], 'message' => ['required', 'string', 'max:250']]);

        $borne = Borne::where('reference', $data['reference'])->first();
        if ($borne) {
            Alerte::lever($borne, 'erreur_ocpp', 'warning', "Erreur OCPP sur {$borne->nom} : {$data['message']}");
        }

        return response()->json(['message' => 'OK']);
    }

    private function etatDepuisConnecteurs(Borne $borne): string
    {
        $etats = $borne->connecteurs()->pluck('etat');

        return match (true) {
            $etats->contains('occupe') => 'occupee',
            $etats->contains('disponible') || $etats->contains('reserve') => 'disponible',
            $etats->isNotEmpty() && $etats->every(fn ($e) => $e === 'defaut') => 'defaut',
            default => 'hors_service',
        };
    }

    private function leverAlerteErreur(Borne $borne, array $data): void
    {
        $code = $data['errorCode'] ?? 'NoError';
        $vendeur = strtolower(($data['vendorErrorCode'] ?? '').' '.($data['info'] ?? ''));

        if (str_contains($vendeur, 'door') || str_contains($vendeur, 'porte')) {
            Alerte::lever($borne, 'porte_ouverte', 'warning', "Porte / trappe ouverte sur {$borne->nom}");

            return;
        }

        if ($code === 'NoError' || $code === 'OtherError' && $vendeur === ' ') {
            return;
        }

        [$type, $gravite] = self::ERREURS[$code] ?? ['erreur_ocpp', 'warning'];
        $libelle = [
            'surchauffe' => 'Surchauffe',
            'coupure_electrique' => 'Coupure / anomalie électrique',
            'defaut_materiel' => 'Défaut matériel',
            'erreur_ocpp' => 'Erreur OCPP',
        ][$type];

        Alerte::lever($borne, $type, $gravite, "{$libelle} sur {$borne->nom} ({$code}".(trim($vendeur) ? ' — '.trim($vendeur) : '').')');
    }
}
