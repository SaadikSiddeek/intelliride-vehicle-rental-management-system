<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class RotateAccountPasswordCommand extends Command
{
    protected $signature = 'intelliride:rotate-account-password {userId : Existing account ID}';

    protected $description = 'Interactively rotate one account password and revoke its access tokens';

    public function handle(): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('Interactive hidden password entry is required.');

            return self::FAILURE;
        }
        $id = (string) $this->argument('userId');
        if (! ctype_digit($id) || (int) $id < 1 || ! User::whereKey($id)->exists()) {
            $this->error('Account not found.');

            return self::FAILURE;
        }
        if (! $this->confirm('Rotate password for account #'.$id.' and revoke all its access tokens?', false)) {
            return self::FAILURE;
        }
        // Hidden fallback is disabled: an unsupported terminal must never echo a password.
        $password = $this->secret('New password', false);
        $confirmation = $this->secret('Confirm new password', false);
        $validator = Validator::make(['password' => $password, 'password_confirmation' => $confirmation], [
            'password' => ['required', 'string', 'confirmed', Password::min(14)->letters()->mixedCase()->numbers()->symbols()],
        ]);
        if ($validator->fails()) {
            $this->error('Password policy or confirmation failed. No account changes were made.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($id, $password) {
            $account = User::whereKey($id)->lockForUpdate()->firstOrFail();
            $account->forceFill(['password' => Hash::make($password)])->save();
            $account->tokens()->delete();
        });
        $password = $confirmation = null;
        $this->info('Password rotated and existing access tokens revoked. Sign in again.');

        return self::SUCCESS;
    }
}
