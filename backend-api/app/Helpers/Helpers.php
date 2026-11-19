<?php
namespace {

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

}


namespace App\Helpers {

use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

class Helpers
{
    public static function encryptVal($value): ?string
    {
        if ($value === null || $value === '') return null;
        $value = (string) $value;
        if (! ctype_digit($value) || (int) $value < 1) throw ValidationException::withMessages(['identifier' => 'Invalid record identifier.']);
        $key = substr(hash_hmac('sha256', $value, (string) config('app.key')), 0, 32);
        $cipher = rtrim(strtr(base64_encode(Crypt::encryptString($value)), '+/', '-_'), '=');
        return 'ir1.'.$key.'.'.$cipher;
    }

    public static function decryptVal($value): ?int
    {
        if ($value === null || $value === '') return null;
        try {
            $parts = explode('.', (string) $value);
            if (count($parts) !== 3 || $parts[0] !== 'ir1') throw new \RuntimeException;
            $encrypted = base64_decode(strtr($parts[2], '-_', '+/'), true);
            if ($encrypted === false || rtrim(strtr(base64_encode($encrypted), '+/', '-_'), '=') !== $parts[2]) throw new \RuntimeException;
            $payload = base64_decode($encrypted, true);
            if ($payload === false || base64_encode($payload) !== $encrypted) throw new \RuntimeException;
            $plain = Crypt::decryptString($encrypted);
            if (! ctype_digit($plain) || filter_var($plain, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) throw new \RuntimeException;
            $key = substr(hash_hmac('sha256', $plain, (string) config('app.key')), 0, 32);
            if (! hash_equals($key, $parts[1])) throw new \RuntimeException;
            return (int) $plain;
        } catch (\Throwable) {
            throw ValidationException::withMessages(['identifier' => 'This record link is invalid. Refresh the page and select it again.']);
        }
    }
}

}
