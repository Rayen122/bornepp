<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['borne_id', 'connecteur_id', 'alerte_id', 'signale_par', 'type', 'gravite', 'description', 'statut', 'resolue_le'])]
class Panne extends Model
{
    use Auditable;

    protected $attributes = ['statut' => 'ouverte', 'gravite' => 'moyenne'];

    protected function casts(): array
    {
        return ['resolue_le' => 'datetime'];
    }

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    public function connecteur(): BelongsTo
    {
        return $this->belongsTo(Connecteur::class);
    }

    public function signaleur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signale_par');
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(Maintenance::class);
    }
}
