<?php

return [
    'users' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CUSTOMER_STAFF_USER_IDS', ''))
    ))),
];
