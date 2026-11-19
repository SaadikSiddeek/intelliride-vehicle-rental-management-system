<?php

namespace App\Services;

class CodeGenerator
{
    /** Codes derive from database-assigned unique keys, never MAX(id)+1. */
    public static function reference(string $type, int|string $id): string
    {
        [$prefix, $width] = match ($type) {
            'customer' => ['CUS-', 6], 'booking' => ['BKG-', 6],
            'rental' => ['RNT-', 6], 'invoice' => ['INV-', 6],
            'payment' => ['PAY-', 0], 'advance' => ['ADV-', 0], 'deposit' => ['DEP-', 0],
            default => throw new \InvalidArgumentException('Unsupported business reference type.'),
        };
        if (! ctype_digit((string) $id) || (int) $id < 1) throw new \InvalidArgumentException('A persisted positive record key is required.');
        return $prefix.str_pad((string) $id, $width, '0', STR_PAD_LEFT);
    }
}
