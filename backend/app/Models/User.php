<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Support\Permissions;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'nom', 'prenom', 'email', 'telephone', 'role', 'actif', 'solde_wallet', 'password'])]
#[Hidden(['password', 'remember_token', 'two_factor_code', 'reset_code'])]
class User extends Authenticatable
{
    use Auditable;

    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $attributes = ['actif' => true, 'role' => 'client', 'solde_wallet' => 0];

    public const ROLES = ['super_admin', 'exploitant', 'operateur', 'technicien', 'service_client', 'finance', 'client'];

    public const ROLES_PERSONNEL = ['super_admin', 'exploitant', 'operateur', 'technicien', 'service_client', 'finance'];

    protected static function booted(): void
    {
        // Jeton unique encodé dans le QR code d'identification du client (module 6).
        static::creating(function (User $user) {
            $user->qr_token ??= Str::random(40);
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'solde_wallet' => 'decimal:2',
            'actif' => 'boolean',
            'derniere_connexion' => 'datetime',
            'two_factor_enabled' => 'boolean',
            'two_factor_expires_at' => 'datetime',
            'reset_code_expires_at' => 'datetime',
        ];
    }

    public function estPersonnel(): bool
    {
        return in_array($this->role, self::ROLES_PERSONNEL, true);
    }

    /** Niveau d'accès du rôle sur un module : aucun, lecture ou ecriture (§7). */
    public function niveau(string $module): string
    {
        return Permissions::niveau($this->role, $module);
    }

    public function peut(string $module, string $niveau = 'lecture'): bool
    {
        return Permissions::autorise($this->role, $module, $niveau);
    }

    /** Abonnement en cours de validité, s'il existe. */
    public function souscriptionActive(): ?Souscription
    {
        return $this->souscriptions()
            ->with('abonnement')
            ->where('statut', 'active')
            ->whereDate('date_debut', '<=', today())
            ->whereDate('date_fin', '>=', today())
            ->latest('date_debut')
            ->first();
    }

    public function vehicules(): HasMany
    {
        return $this->hasMany(Vehicule::class);
    }

    public function badges(): HasMany
    {
        return $this->hasMany(BadgeRfid::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(SessionRecharge::class);
    }

    public function factures(): HasMany
    {
        return $this->hasMany(Facture::class);
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class);
    }

    public function souscriptions(): HasMany
    {
        return $this->hasMany(Souscription::class);
    }
}
