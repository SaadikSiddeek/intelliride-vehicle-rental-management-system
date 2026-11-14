<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function signup(Request $request)
    {
        // Business accounts are provisioned only through authorized administration.
        abort(403, 'Self-registration is unavailable. Contact your administrator for an account.');
    }

    public function login(LoginRequest $request)
    {
        $credentials = $request->validated();

        if (! Auth::attempt($credentials)) {
            return response([
                'message' => 'Provided email address or password is incorrect',
            ], 422);
        }

        /** @var User $user */
        $user = Auth::user();
        if (! $user->status) {
            Auth::logout();
            abort(403, 'This account is inactive. Contact your administrator.');
        }

        $token = $user->createToken(
            'main',
            ['*'],
            now()->addMinutes(30)
        )->plainTextToken;

        return response([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function changeInitialPassword(Request $request)
    {
        abort_unless($request->user()->fresh()?->must_change_password, 403, 'Initial password change is not required for this account.');
        $fields = $request->validate([
            'current_password' => ['required', 'string', 'max:1024'],
            'password' => ['required', 'string', 'min:12', 'confirmed', 'different:current_password', new \App\Rules\InstallationPassword],
            'user_id' => ['prohibited'], 'user_type' => ['prohibited'],
        ]);
        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $fields) {
            $user = User::where('ID', $request->user()->ID)->lockForUpdate()->firstOrFail();
            abort_unless($user->status && $user->must_change_password, 403, 'Initial password change is not required for this account.');
            if (! \Illuminate\Support\Facades\Hash::check($fields['current_password'], $user->password)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['current_password' => 'The current password is incorrect.']);
            }
            $user->forceFill(['password' => $fields['password'], 'must_change_password' => false])->save();
            // Keep this authenticated session; invalidate any other installation sessions.
            $current = $request->user()->currentAccessToken();
            $currentId = $current instanceof \Laravel\Sanctum\PersonalAccessToken ? $current->getKey() : null;
            $user->tokens()->when($currentId, fn ($q, $id) => $q->where('id', '!=', $id))->delete();
            app(\App\Services\PermissionService::class)->audit($user->ID, $user->ID, 'installation_password_changed', 'Owner completed required first-login password change', ['must_change_password' => true], ['must_change_password' => false]);
            return response()->json(['message' => 'Installation password changed.', 'user' => $user->fresh()]);
        });
    }

    public function logout(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        $user->currentAccessToken()->delete();

        return response('', 204);
    }

    public function activity(Request $request)
    {
        $token = $request->user()->currentAccessToken();

        $token->forceFill([
            'expires_at' => now()->addMinutes(30),
        ])->save();

        return response()->noContent();
    }
}
