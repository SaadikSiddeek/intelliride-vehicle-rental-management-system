<?php

namespace App\Http\Middleware;

use App\Services\AccessService;
use Closure;
use Illuminate\Http\Request;

class RequireAdministration
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless(app(AccessService::class)->administration($request->user()), 403, 'Administrator access is required.');

        return $next($request);
    }
}
