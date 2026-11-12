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
