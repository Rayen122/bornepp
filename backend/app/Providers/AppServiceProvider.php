<?php

namespace App\Providers;

use App\Jobs\EnvoyerNotificationsAlerte;
use App\Models\Alerte;
use App\Models\Borne;
use App\Models\DeploiementFirmware;
use App\Models\SessionRecharge;
use App\Services\TempsReel;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // L'app mobile attend des tableaux bruts, sans enveloppe {"data": ...}.
        JsonResource::withoutWrapping();

        // Supervision temps réel (module 4) : chaque changement d'état part vers le back-office.
        Borne::updated(function (Borne $borne) {
            if ($borne->wasChanged(['etat', 'dernier_heartbeat', 'temperature_c'])) {
                TempsReel::borne($borne);
            }
        });
        SessionRecharge::saved(fn (SessionRecharge $s) => TempsReel::session($s));
        DeploiementFirmware::saved(fn (DeploiementFirmware $d) => TempsReel::firmware($d));

        // Alertes automatiques (module 12) : diffusion immédiate + notifications en file d'attente.
        Alerte::created(function (Alerte $alerte) {
            TempsReel::alerte($alerte);
            EnvoyerNotificationsAlerte::dispatch($alerte);
        });
    }
}
