<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['firmware_id', 'borne_id', 'version_precedente', 'statut', 'rollback', 'message', 'lance_par'])]
class DeploiementFirmware extends Model
{
    protected $attributes = ['statut' => 'en_attente', 'rollback' => false];

    protected $table = 'deploiements_firmware';

    public const STATUTS_EN_COURS = ['en_attente', 'telechargement', 'telecharge', 'installation'];

    protected function casts(): array
    {
        return ['rollback' => 'boolean'];
    }

    public function firmware(): BelongsTo
    {
        return $this->belongsTo(Firmware::class);
    }

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    public function lanceur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lance_par');
    }
}
