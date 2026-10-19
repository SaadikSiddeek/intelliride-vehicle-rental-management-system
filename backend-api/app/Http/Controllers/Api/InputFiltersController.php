<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class InputFiltersController extends Controller
{

    public function getBranchFilters(Request $request)
    {

        try {

            $query = DB::table('branch_tb')
                ->select('ID', 'branch_name', 'branch_code')
                ->get();

            $data = $query->map(function ($res) {

                return [
                    'id' => $res->ID,
                    'name' => $res->branch_name,
                    'code' => $res->branch_code,
                    'text' => $res->branch_code . ' ' . $res->branch_name,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Throwable $th) {
            //throw $th;
        }
    }
}
