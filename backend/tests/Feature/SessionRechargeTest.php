<?php

use App\Models\Borne;
use App\Models\Connecteur;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function creerBorneAvecConnecteur(): array
{
    $borne = Borne::create([
        'nom' => 'Borne Test',
        'reference' => 'BRN-TEST-001',
        'numero_serie' => 'SN-TEST',
        'modele' => 'Test',
        'fabricant' => 'Test',
        'adresse' => 'Tunis',
        'latitude' => 36.8,
        'longitude' => 10.18,
        'version_firmware' => '1.0',
        'version_ocpp' => '1.6',
        'puissance_kw' => 22,
        'etat' => 'disponible',
        'tarif_kwh' => 0.5,
    ]);

    $connecteur = Connecteur::create([
        'borne_id' => $borne->id,
        'type' => 'Type2',
        'puissance_kw' => 22,
        'etat' => 'disponible',
    ]);

    return [$borne, $connecteur];
}

function clientConnecte(float $solde = 100): User
{
    $user = User::create([
        'name' => 'Client Session',
        'nom' => 'Session',
        'prenom' => 'Client',
        'email' => 'session@test.tn',
        'password' => 'password',
        'role' => 'client',
        'solde_wallet' => $solde,
    ]);
    Sanctum::actingAs($user);

    return $user;
}

it('démarre une recharge et occupe le connecteur', function () {
    [$borne, $connecteur] = creerBorneAvecConnecteur();
    clientConnecte();

    $this->postJson('/api/v1/sessions', [
        'borne_id' => $borne->id,
        'connecteur_id' => $connecteur->id,
    ])->assertCreated()
        ->assertJsonPath('etat', 'en_cours')
        ->assertJsonPath('energieKwh', 0);

    expect($connecteur->fresh()->etat)->toBe('occupe')
        ->and($borne->fresh()->etat)->toBe('occupee');
});

it('refuse une deuxième recharge simultanée', function () {
    [$borne, $connecteur] = creerBorneAvecConnecteur();
    clientConnecte();

    $this->postJson('/api/v1/sessions', [
        'borne_id' => $borne->id,
        'connecteur_id' => $connecteur->id,
    ])->assertCreated();

    $this->postJson('/api/v1/sessions', [
        'borne_id' => $borne->id,
        'connecteur_id' => $connecteur->id,
    ])->assertUnprocessable();
});

it("arrête la recharge, facture et débite le wallet", function () {
    [$borne, $connecteur] = creerBorneAvecConnecteur();
    $user = clientConnecte(solde: 100);

    $id = $this->postJson('/api/v1/sessions', [
        'borne_id' => $borne->id,
        'connecteur_id' => $connecteur->id,
    ])->json('id');

    // Simule la télémétrie OCPP : 10 kWh consommés.
    \App\Models\SessionRecharge::find($id)->update(['energie_kwh' => 10]);

    $this->postJson("/api/v1/sessions/{$id}/stop")
        ->assertOk()
        ->assertJsonPath('etat', 'terminee')
        ->assertJsonPath('prix', 5); // 10 kWh × 0,50

    expect((float) $user->fresh()->solde_wallet)->toBe(95.0)
        ->and($connecteur->fresh()->etat)->toBe('disponible')
        ->and($borne->fresh()->etat)->toBe('disponible');

    $this->assertDatabaseHas('paiements', ['session_recharge_id' => $id, 'statut' => 'paye', 'methode' => 'wallet']);
    $this->assertDatabaseHas('factures', ['session_recharge_id' => $id, 'montant_ttc' => 5]);
});

it('met le paiement en attente si le solde est insuffisant', function () {
    [$borne, $connecteur] = creerBorneAvecConnecteur();
    $user = clientConnecte(solde: 1);

    $id = $this->postJson('/api/v1/sessions', [
        'borne_id' => $borne->id,
        'connecteur_id' => $connecteur->id,
    ])->json('id');

    \App\Models\SessionRecharge::find($id)->update(['energie_kwh' => 10]);
    $this->postJson("/api/v1/sessions/{$id}/stop")->assertOk();

    expect((float) $user->fresh()->solde_wallet)->toBe(1.0);
    $this->assertDatabaseHas('paiements', ['session_recharge_id' => $id, 'statut' => 'en_attente']);
});

it('recharge le wallet via topup', function () {
    $user = clientConnecte(solde: 10);

    $this->postJson('/api/v1/wallet/topup', ['montant' => 50])
        ->assertOk()
        ->assertJsonPath('soldeWallet', 60);

    $this->assertDatabaseHas('paiements', ['user_id' => $user->id, 'methode' => 'topup_carte', 'statut' => 'paye']);
});

it("interdit d'arrêter la session d'un autre client", function () {
    [$borne, $connecteur] = creerBorneAvecConnecteur();
    clientConnecte();

    $id = $this->postJson('/api/v1/sessions', [
        'borne_id' => $borne->id,
        'connecteur_id' => $connecteur->id,
    ])->json('id');

    $autre = User::create([
        'name' => 'Autre', 'nom' => 'Autre', 'prenom' => 'Client',
        'email' => 'autre@test.tn', 'password' => 'password', 'role' => 'client',
    ]);
    Sanctum::actingAs($autre);

    $this->postJson("/api/v1/sessions/{$id}/stop")->assertForbidden();
});

it('renvoie null quand aucune recharge n\'est en cours', function () {
    clientConnecte();

    $reponse = $this->getJson('/api/v1/sessions/active')->assertOk();

    expect($reponse->getContent())->toBe('null');
});

it('refuse de démarrer une recharge sur une borne publique', function () {
    [$borne, $connecteur] = creerBorneAvecConnecteur();
    $borne->update(['source' => 'publique']);
    clientConnecte();

    $this->postJson('/api/v1/sessions', [
        'borne_id' => $borne->id,
        'connecteur_id' => $connecteur->id,
    ])->assertUnprocessable()->assertJsonValidationErrors('borne_id');
});
