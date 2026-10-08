<?php

namespace App\Http\Resources;

use App\Services\Tarification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Sortie alignée sur le type `Borne` de l'app mobile (champs back-office ajoutés). */
class BorneResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'source' => $this->source,
            'operateur' => $this->operateur,
            'nom' => $this->nom,
            'reference' => $this->reference,
            'numeroSerie' => $this->numero_serie,
            'modele' => $this->modele,
            'fabricant' => $this->fabricant,
            'adresse' => $this->adresse,
            'site' => $this->site,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'versionFirmware' => $this->version_firmware,
            'versionOcpp' => $this->version_ocpp,
            'puissanceKw' => $this->puissance_kw,
            'etat' => $this->etat,
            'enLigne' => $this->estEnLigne(),
            'dernierHeartbeat' => $this->dernier_heartbeat?->toIso8601String(),
            'temperatureC' => $this->temperature_c,
            'tarifKwh' => $this->tarif_kwh,
            'tarifId' => $this->tarif_id,
            'tarifSpecialId' => $this->tarif_special_id,
            'tarifLibelle' => $this->when($this->relationLoaded('tarif'), fn () => app(Tarification::class)->libelle($this->resource)),
            // Tarif en vigueur détaillé (mode, heures creuses, frais) pour l'estimation côté client.
            'tarifApplique' => $this->when($this->relationLoaded('tarif'), function () {
                $tarif = app(Tarification::class)->tarifApplicable($this->resource);

                return $tarif ? [
                    'nom' => $tarif->nom,
                    'mode' => $tarif->mode,
                    'prix' => $tarif->prix,
                    'prixHeuresCreuses' => $tarif->prix_heures_creuses,
                    'heuresCreusesDebut' => $tarif->heures_creuses_debut ? substr($tarif->heures_creuses_debut, 0, 5) : null,
                    'heuresCreusesFin' => $tarif->heures_creuses_fin ? substr($tarif->heures_creuses_fin, 0, 5) : null,
                    'fraisSession' => $tarif->frais_session,
                    'special' => $tarif->special,
                    'valideAu' => $tarif->valide_au?->format('Y-m-d'),
                ] : null;
            }),
            'exploitantId' => $this->exploitant_id,
            'exploitantNom' => $this->when($this->relationLoaded('exploitant'), fn () => Concerns::nomComplet($this->exploitant)),
            'technicienId' => $this->technicien_id,
            'technicienNom' => $this->when($this->relationLoaded('technicien'), fn () => Concerns::nomComplet($this->technicien)),
            'alertesOuvertes' => $this->whenCounted('alertes_ouvertes'),
            'connecteurs' => ConnecteurResource::collection($this->whenLoaded('connecteurs')),
        ];
    }
}
