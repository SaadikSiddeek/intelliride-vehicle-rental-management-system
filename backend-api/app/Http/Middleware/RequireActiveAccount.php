<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequireActiveAccount
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        $verified = $user?->exists ? $user->fresh() : $user;
        abort_unless($verified?->status, 403, 'This account is inactive. Contact your administrator.');
        if ($verified->must_change_password && ! in_array($request->path(), ['api/user', 'api/logout', 'api/auth/activity', 'api/auth/password'], true)) {
            return response()->json(['message' => 'Change your installation password before continuing.', 'code' => 'PASSWORD_CHANGE_REQUIRED'], 403);
        }

        return $next($request);
    }
}
