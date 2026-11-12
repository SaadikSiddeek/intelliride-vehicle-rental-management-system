<?php

return [
    'identity_report_user_ids' => array_values(array_filter(array_map('trim', explode(',', (string) env('RENTAL_IDENTITY_REPORT_USER_IDS', ''))))),
    'company' => [
        'name' => 'IntelliRide', 'address' => env('INVOICE_BUSINESS_ADDRESS'),
        'phone' => env('INVOICE_BUSINESS_PHONE'), 'registration_number' => env('INVOICE_REGISTRATION_NUMBER'),
        'tax_identifier' => env('INVOICE_TAX_IDENTIFIER'),
        'invoice_notes' => env('INVOICE_FOOTER_NOTES', 'Thank you for choosing IntelliRide.'),
    ],
    'timezone' => 'Asia/Colombo',
    // Confirmed business policy; snapshot these settings at handover.
    'return_policy' => [
        'version' => 1,
        'grace_minutes' => 60,
        'daily_hourly_basis_points' => 1000,
        'weekly_monthly_hourly_rate' => null,
        'weekly_monthly_24h_cap' => null,
        'fuel_price_per_litre' => null,
        'fuel_service_charge' => '0.00',
    ],
    // Configure the applicable business tax; no tax is assumed by default.
    'tax_basis_points' => (int) env('RENTAL_TAX_BASIS_POINTS', 0),
    'pricing_user_ids' => array_values(array_filter(array_map('trim', explode(',', (string) env('RENTAL_PRICING_USER_IDS', ''))))),
    // Each extra has a stable code, label and fixed amount string in LKR.
    'extras' => [],
];
