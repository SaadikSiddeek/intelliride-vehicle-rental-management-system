<?php
namespace App\Console\Commands;
use App\Services\InstallationBranch;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
class SelectInstallationBranch extends Command {
 protected $signature='intelliride:installation-branch {code? : Existing branch code} {--confirm : Confirm the reviewed one-time selection}';
 protected $description='Inspect or explicitly select the installation branch; never reassign historical records';
 public function handle(InstallationBranch $branches): int {
  if(!Schema::hasTable('installation_settings_tb')) { $this->error('Apply the additive installation-settings migration first.'); return self::FAILURE; }
  if(!$this->argument('code')) {
   foreach(DB::table('branch_tb')->get(['branch_code','branch_name']) as $row) $this->line($row->branch_code.' — '.$row->branch_name);
   try { $this->info('Selected: '.$branches->current()->branch_code); } catch(\Illuminate\Validation\ValidationException) { $this->warn('Explicit owner selection is required. No data was changed.'); }
   return self::SUCCESS;
  }
  $branch=DB::table('branch_tb')->where('branch_code',$this->argument('code'))->first();
  if(!$branch || !$branch->status) { $this->error('Choose an existing active branch code.'); return self::FAILURE; }
  $this->line('Installation branch: '.$branch->branch_code.' — '.$branch->branch_name.'. Historical relationships will not change.');
  if(!$this->option('confirm') && !$this->confirm('Save this reviewed installation choice?',false)) return self::FAILURE;
  return DB::transaction(function() use($branch) {
   $state=DB::table('installation_settings_tb')->where('ID',1)->lockForUpdate()->first();
   if($state->branch_id && (int)$state->branch_id !== (int)$branch->ID) { $this->error('An installation branch is already configured. Review a separate relocation plan; nothing changed.'); return self::FAILURE; }
   DB::table('installation_settings_tb')->where('ID',1)->update(['branch_id'=>$branch->ID]);
   $this->info('Installation branch saved. Existing branches, account links and transactions were preserved.'); return self::SUCCESS;
  });
 }
}
