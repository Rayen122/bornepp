<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Sortie alignée sur le type `Utilisateur` de l'app mobile (+ permissions pour le web). */
class UtilisateurResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nom' => $this->nom,
            'prenom' => $this->prenom,
            'email' => $this->email,
            'telephone' => $this->telephone,
            'role' => $this->role,
            'soldeWallet' => (float) $this->solde_wallet,
            'deuxFacteurs' => (bool) $this->two_factor_enabled,
            'qrToken' => $this->qr_token,
            'permissions' => collect(config('plateforme.modules'))
                ->mapWithKeys(fn ($_, $module) => [$module => $this->niveau($module)]),
        ];
    }
}
