<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'source', 'source_id', 'operateur', 'nom', 'reference', 'numero_serie', 'modele', 'fabricant', 'adresse',
    'latitude', 'longitude', 'version_firmware', 'version_ocpp',
    'puissance_kw', 'etat', 'dernier_heartbeat', 'temperature_c', 'tarif_kwh',
    'tarif_id', 'tarif_special_id', 'exploitant_id', 'technicien_id', 'site',
])]
class Borne extends Model
{
    use Auditable;

    public const ETATS = ['disponible', 'occupee', 'hors_service', 'maintenance', 'deconnectee', 'defaut'];

    /** Au-delà, une borne sans heartbeat est considérée hors ligne. */
    public const DELAI_HEARTBEAT_MINUTES = 5;

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'puissance_kw' => 'integer',
            'dernier_heartbeat' => 'datetime',
            'temperature_c' => 'float',
            'tarif_kwh' => 'float',
        ];
    }

    public function estEnLigne(): bool
    {
        return $this->dernier_heartbeat !== null
            && $this->dernier_heartbeat->gt(now()->subMinutes(self::DELAI_HEARTBEAT_MINUTES))
            && $this->etat !== 'deconnectee';
    }

    public function connecteurs(): HasMany
    {
        return $this->hasMany(Connecteur::class);
    }

    public function alertes(): HasMany
    {
        return $this->hasMany(Alerte::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(SessionRecharge::class);
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(Maintenance::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function tarif(): BelongsTo
    {
        return $this->belongsTo(Tarif::class);
    }

    public function tarifSpecial(): BelongsTo
    {
        return $this->belongsTo(Tarif::class, 'tarif_special_id');
    }

    public function exploitant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'exploitant_id');
    }

    public function technicien(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technicien_id');
    }
}
