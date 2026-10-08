<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Sortie alignée sur le type `Vehicule` de l'app mobile. */
class VehiculeResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'marque' => $this->marque,
            'modele' => $this->modele,
            'immatriculation' => $this->immatriculation,
            'typeConnecteur' => $this->type_connecteur,
            'capaciteBatterieKwh' => $this->capacite_batterie_kwh,
        ];
    }
}
