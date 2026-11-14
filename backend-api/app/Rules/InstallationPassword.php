<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class InstallationPassword implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Bcrypt must neither truncate a long password nor fail on null bytes.
        if (is_string($value) && (strlen($value) > 72 || str_contains($value, "\0"))) {
            $fail('Use a password of at most 72 UTF-8 bytes without null characters.');
        }
    }
}
