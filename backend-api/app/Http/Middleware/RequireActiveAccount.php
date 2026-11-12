<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequireActiveAccount
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless($request->user()?->status, 403, 'This account is inactive. Contact your administrator.');

        return $next($request);
    }
}
