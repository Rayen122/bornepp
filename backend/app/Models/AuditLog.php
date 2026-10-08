<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'action', 'cible', 'details', 'ip'])]
class AuditLog extends Model
{
    /** Journalise une action (module 18 — traçabilité complète). */
    public static function record(?int $userId, string $action, ?string $cible = null, ?string $details = null): void
    {
        static::create([
            'user_id' => $userId,
            'action' => $action,
            'cible' => $cible,
            'details' => $details,
            'ip' => request()->ip(),
        ]);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
