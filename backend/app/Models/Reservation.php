<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'borne_id', 'connecteur_id', 'expire_le', 'statut'])]
class Reservation extends Model
{
    public const DUREE_MINUTES = 15;

    protected function casts(): array
    {
        return ['expire_le' => 'datetime'];
    }

    /**
     * Clôt les réservations échues et libère leur prise. Appelée à chaque
     * lecture concernée : pas besoin d'attendre le planificateur.
     */
    public static function expirerPerimees(): void
    {
        static::where('statut', 'active')
            ->where('expire_le', '<=', now())
            ->with('connecteur')
            ->get()
            ->each(function (Reservation $r) {
                $r->update(['statut' => 'expiree']);
                if ($r->connecteur?->etat === 'reserve') {
                    $r->connecteur->update(['etat' => 'disponible']);
                }
            });
    }

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    public function connecteur(): BelongsTo
    {
        return $this->belongsTo(Connecteur::class);
    }
}
