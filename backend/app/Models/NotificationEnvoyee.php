<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Trace de chaque notification d'alerte émise (email, SMS, push). */
#[Fillable(['alerte_id', 'canal', 'destinataire', 'sujet', 'contenu', 'statut', 'erreur'])]
class NotificationEnvoyee extends Model
{
    protected $table = 'notifications_envoyees';

    public function alerte(): BelongsTo
    {
        return $this->belongsTo(Alerte::class);
    }
}
