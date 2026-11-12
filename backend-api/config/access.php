<?php

// Explicit deployment-local assignments. Empty lists deny access; null keeps the legacy ID mapping.
$list = static fn ($value) => array_values(array_filter(array_map('trim', explode(',', (string) $value)), static fn ($v) => $v !== ''));
$optional = static fn ($key) => env($key) === null ? null : $list(env($key));

return [
    'operations_users' => $optional('RENTAL_OPERATIONS_USER_IDS'),
    'operations_roles' => $list(env('RENTAL_OPERATIONS_ROLE_NAMES', '')),
    'customer_roles' => $list(env('CUSTOMER_STAFF_ROLE_NAMES', '')),
    'administration_users' => $optional('ADMIN_USER_IDS'),
    'company_users' => $optional('COMPANY_SETTINGS_USER_IDS'),
    'administrator_roles' => $list(env('ADMIN_ROLE_NAMES', 'Admin')),
];
