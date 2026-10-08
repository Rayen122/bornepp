<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UtilisateurResource;
use App\Models\AuditLog;
use App\Models\Parametre;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            AuditLog::record($user?->id, 'connexion_echouee', $user ? 'user:'.$user->id : null, $credentials['email']);
            throw ValidationException::withMessages([
                'email' => ['Email ou mot de passe invalide.'],
            ]);
        }

        if (! $user->actif) {
            throw ValidationException::withMessages([
                'email' => ['Ce compte est désactivé. Contactez le support.'],
            ]);
        }

        // Double authentification : un code à 6 chiffres est envoyé par email,
        // le token n'est délivré qu'après vérification via /auth/2fa/verify.
        // Elle peut être rendue obligatoire pour tout le personnel (paramétrage).
        $deuxFacteurs = $user->two_factor_enabled
            || ($user->estPersonnel() && Parametre::get('deux_facteurs_personnel'));

        if ($deuxFacteurs) {
            $code = (string) random_int(100000, 999999);
            $user->forceFill([
                'two_factor_code' => Hash::make($code),
                'two_factor_expires_at' => now()->addMinutes(10),
            ])->save();

            $this->envoyerCode($user, 'Votre code de connexion '.Parametre::get('plateforme_nom'), $code);

            return response()->json(['twoFactor' => true]);
        }

        return $this->connecter($user, 'connexion');
    }

    public function verify2fa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! $user->two_factor_code
            || $user->two_factor_expires_at?->isPast()
            || ! Hash::check($data['code'], $user->two_factor_code)) {
            throw ValidationException::withMessages(['code' => ['Code invalide ou expiré.']]);
        }

        $user->forceFill(['two_factor_code' => null, 'two_factor_expires_at' => null])->save();

        return $this->connecter($user, 'connexion_2fa');
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::create([
            'name' => $data['prenom'].' '.$data['nom'],
            'nom' => $data['nom'],
            'prenom' => $data['prenom'],
            'email' => $data['email'],
            'telephone' => $data['telephone'] ?? null,
            'password' => $data['password'],
            'role' => 'client',
        ]);

        AuditLog::record($user->id, 'inscription', 'user:'.$user->id);

        return response()->json([
            'token' => $user->createToken('mobile')->plainTextToken,
            'user' => new UtilisateurResource($user),
        ], 201);
    }

    /** Envoie un code de réinitialisation à 6 chiffres (valable 15 min). */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $data['email'])->first();

        if ($user) {
            $code = (string) random_int(100000, 999999);
            $user->forceFill([
                'reset_code' => Hash::make($code),
                'reset_code_expires_at' => now()->addMinutes(15),
            ])->save();

            $this->envoyerCode($user, 'Réinitialisation de votre mot de passe '.Parametre::get('plateforme_nom'), $code);
        }

        // Réponse identique que l'email existe ou non (pas d'énumération de comptes).
        return response()->json(['message' => 'Si ce compte existe, un code a été envoyé par email.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! $user->reset_code
            || $user->reset_code_expires_at?->isPast()
            || ! Hash::check($data['code'], $user->reset_code)) {
            throw ValidationException::withMessages(['code' => ['Code invalide ou expiré.']]);
        }

        $user->forceFill([
            'password' => $data['password'],
            'reset_code' => null,
            'reset_code_expires_at' => null,
        ])->save();

        $user->tokens()->delete();
        AuditLog::record($user->id, 'reinitialisation_mot_de_passe', 'user:'.$user->id);

        return response()->json(['message' => 'Mot de passe réinitialisé, vous pouvez vous connecter.']);
    }

    public function logout(Request $request): JsonResponse
    {
        AuditLog::record($request->user()->id, 'deconnexion', 'user:'.$request->user()->id);
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Déconnecté']);
    }

    public function me(Request $request): UtilisateurResource
    {
        return new UtilisateurResource($request->user());
    }

    /** Mise à jour du profil par l'utilisateur lui-même. */
    public function profil(Request $request): UtilisateurResource
    {
        $user = $request->user();
        $data = $request->validate([
            'nom' => ['sometimes', 'string', 'max:100'],
            'prenom' => ['sometimes', 'string', 'max:100'],
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'telephone' => ['nullable', 'string', 'max:30'],
            'motDePasseActuel' => ['required_with:nouveauMotDePasse', 'string'],
            'nouveauMotDePasse' => ['sometimes', 'string', 'min:8'],
        ]);

        if (isset($data['nouveauMotDePasse'])) {
            if (! Hash::check($data['motDePasseActuel'], $user->password)) {
                throw ValidationException::withMessages(['motDePasseActuel' => ['Mot de passe actuel incorrect.']]);
            }
            $user->password = $data['nouveauMotDePasse'];
        }

        $user->fill(collect($data)->only(['nom', 'prenom', 'email', 'telephone'])->all());
        $user->name = trim($user->prenom.' '.$user->nom);
        $user->save();

        return new UtilisateurResource($user);
    }

    /** Active / désactive la double authentification par email. */
    public function deuxFacteurs(Request $request): UtilisateurResource
    {
        $data = $request->validate(['actif' => ['required', 'boolean']]);
        $request->user()->forceFill(['two_factor_enabled' => $data['actif']])->save();
        AuditLog::record($request->user()->id, $data['actif'] ? '2fa_activee' : '2fa_desactivee', 'user:'.$request->user()->id);

        return new UtilisateurResource($request->user());
    }

    private function connecter(User $user, string $action): JsonResponse
    {
        $user->forceFill(['derniere_connexion' => now()])->save();
        AuditLog::record($user->id, $action, 'user:'.$user->id);

        return response()->json([
            'token' => $user->createToken($user->estPersonnel() ? 'web' : 'mobile')->plainTextToken,
            'user' => new UtilisateurResource($user),
        ]);
    }

    /** En dev (MAIL_MAILER=log) le code apparaît dans storage/logs/laravel.log. */
    private function envoyerCode(User $user, string $sujet, string $code): void
    {
        Mail::raw("Votre code : {$code}\nIl expire dans quelques minutes.", function ($mail) use ($user, $sujet) {
            $mail->to($user->email)->subject($sujet);
        });
    }
}
