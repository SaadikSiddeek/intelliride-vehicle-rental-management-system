<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 private const INDEXES = [
  ['booking_tb','booking_branch_pickup_report_idx',['pickup_branch_id','status','pickup_at']],
  ['booking_tb','booking_branch_activity_idx',['pickup_branch_id','created_at']],
  ['rental_tb','rental_branch_activity_idx',['pickup_branch_id','actual_pickup_at']],
  ['invoice_tb','invoice_period_report_idx',['issued_on','rental_id']],
  ['booking_payment_tb','advance_period_report_idx',['paid_on','booking_id']],
  ['invoice_payment_tb','receipt_period_report_idx',['paid_on','invoice_id']],
  ['rental_deposit_tb','deposit_period_report_idx',['created_at','rental_id']],
 ];
 public function up():void {foreach(self::INDEXES as[$table,$name,$columns])if(!Schema::hasIndex($table,$name))Schema::table($table,fn(Blueprint$t)=>$t->index($columns,$name));}
 public function down():void {foreach(array_reverse(self::INDEXES)as[$table,$name])if(Schema::hasIndex($table,$name))Schema::table($table,fn(Blueprint$t)=>$t->dropIndex($name));}
};
