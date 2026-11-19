<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ActorDisplay
{
    /** One lookup for a page of account-backed audit entries, including inactive employees. */
    public static function names(iterable $ids): Collection
    {
        $ids = collect($ids)->filter()->unique()->values();
        if ($ids->isEmpty()) {
            return collect();
        }

        return DB::table('users_tb as account')
            ->leftJoin('staff_tb as employee', 'employee.ID', '=', 'account.emp_id')
            ->whereIntegerInRaw('account.ID', $ids)
            ->get(['account.ID', 'account.username', 'employee.first_name', 'employee.last_name'])
            ->mapWithKeys(fn ($actor) => [$actor->ID => trim($actor->first_name.' '.$actor->last_name) ?: $actor->username]);
    }

    public static function label($id, Collection $names, string $absent = 'Not recorded'): string
    {
        return $id === null ? $absent : ($names->get($id) ?: 'Account unavailable');
    }
}
