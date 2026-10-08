<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['user_id', 'uid', 'libelle', 'actif', 'bloque', 'motif_blocage', 'date_expiration', 'derniere_utilisation'])]
class BadgeRfid extends Model
{
    use Auditable;

    protected $table = 'badges_rfid';

    protected $attributes = ['actif' => true, 'bloque' => false];

    protected function casts(): array
    {
        return [
            'actif' => 'boolean',
            'bloque' => 'boolean',
            'date_expiration' => 'date:Y-m-d',
            'derniere_utilisation' => 'datetime',
        ];
    }

    public function estExpire(): bool
    {
        return $this->date_expiration !== null && $this->date_expiration->endOfDay()->isPast();
    }

    /** Statut OCPP renvoyé à la borne lors d'un Authorize : Accepted, Blocked, Expired, Invalid. */
    public function statutOcpp(): string
    {
        return match (true) {
            $this->bloque => 'Blocked',
            $this->estExpire() => 'Expired',
            ! $this->actif || ! $this->user_id || ! $this->user?->actif => 'Invalid',
            default => 'Accepted',
        };
    }

    /** Statut lisible pour le back-office. */
    public function statut(): string
    {
        return match (true) {
            $this->bloque => 'bloque',
            $this->estExpire() => 'expire',
            ! $this->actif => 'inactif',
            ! $this->user_id => 'non_associe',
            default => 'actif',
        };
    }

    public function journaliser(string $evenement, ?string $details = null, ?int $borneId = null): void
    {
        $this->evenements()->create([
            'acteur_id' => auth()->id(),
            'borne_id' => $borneId,
            'evenement' => $evenement,
            'details' => $details,
        ]);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function evenements(): HasMany
    {
        return $this->hasMany(BadgeEvenement::class);
    }
}
