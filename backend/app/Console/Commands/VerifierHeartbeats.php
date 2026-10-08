<?php

namespace App\Console\Commands;

use App\Models\Alerte;
use App\Models\Borne;
use App\Models\Parametre;
use Illuminate\Console\Command;

/**
 * Marque « déconnectée » toute borne silencieuse depuis plus de N minutes
 * (paramètre delai_heartbeat_minutes, 5 par défaut) et lève l'alerte
 * correspondante (modules 4 et 12). Planifiée toutes les minutes.
 */
class VerifierHeartbeats extends Command
{
    protected $signature = 'bornes:verifier-heartbeats';

    protected $description = 'Détecte les bornes qui n\'émettent plus de heartbeat';

    public function handle(): int
    {
        $delai = (int) Parametre::get('delai_heartbeat_minutes', Borne::DELAI_HEARTBEAT_MINUTES);

        $silencieuses = Borne::where('source', 'reseau')
            ->whereNotIn('etat', ['deconnectee', 'hors_service', 'maintenance'])
            ->where(function ($q) use ($delai) {
                $q->whereNull('dernier_heartbeat')
                    ->orWhere('dernier_heartbeat', '<', now()->subMinutes($delai));
            })
            ->get();

        foreach ($silencieuses as $borne) {
            $borne->update(['etat' => 'deconnectee']);
            Alerte::lever($borne, 'borne_deconnectee', 'warning', "{$borne->nom} n'a plus émis de heartbeat depuis {$delai} minutes");
            $this->info("Borne {$borne->reference} marquée déconnectée.");
        }

        return self::SUCCESS;
    }
}
