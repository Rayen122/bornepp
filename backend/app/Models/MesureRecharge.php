<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['session_recharge_id', 'horodatage', 'energie_kwh', 'puissance_kw', 'pourcentage_batterie'])]
class MesureRecharge extends Model
{
    protected $table = 'mesures_recharge';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'horodatage' => 'datetime',
            'energie_kwh' => 'float',
            'puissance_kw' => 'float',
            'pourcentage_batterie' => 'integer',
        ];
    }
}
