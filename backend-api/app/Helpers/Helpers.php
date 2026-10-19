<?php

use Illuminate\Support\Facades\Auth;

if (! function_exists('get_user_id')) {
    function get_user_id()
    {
        return Auth::id();
    }
}

if (! function_exists('get_br_id')) {
    function get_br_id()
    {
        return Auth::user()?->branch_id;
    }
}
