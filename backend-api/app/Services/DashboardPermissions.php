<?php

namespace App\Services;

use App\Models\User;

class DashboardPermissions
{
    public function redact(array $data, User $user, PermissionService $p): array
    {
        if (! $p->enabled()) {
            return $data;
        }
        $finance = $p->can($user, 'dashboard.finance');
        $operations = $p->can($user, 'dashboard.operations');
        $staff = $p->can($user, 'dashboard.staff_activity');
        $data['visibility'] = compact('finance', 'operations', 'staff');
        if (! $finance) {
            unset($data['period'], $data['daily'], $data['analytics']['previous']);
            foreach (['outstanding_invoices', 'outstanding_balance', 'deposit_held', 'completed_deposit_count', 'completed_deposit_unsettled'] as $key) {
                unset($data['current'][$key]);
            }
        }
        if (! $operations) {
            $data['current'] = array_intersect_key($data['current'], array_flip(['outstanding_invoices', 'outstanding_balance', 'deposit_held', 'completed_deposit_count', 'completed_deposit_unsettled']));
            unset($data['returns'], $data['fleet_status']);
            $data['analytics'] = array_intersect_key($data['analytics'], array_flip(['previous']));
        } else {
            $data['analytics']['activity'] = array_values(array_filter($data['analytics']['activity'], static fn ($a) => ($finance || ! in_array($a['kind'], ['Invoice issued', 'Payment recorded'], true)) && ($staff || ! in_array($a['kind'], ['Vehicle handed over', 'Return finalized'], true))));
            if (! $staff) {
                foreach ($data['analytics']['returns'] as &$r) {
                    unset($r['staff']);
                }
            }
        }
        return $data;
    }
}
