<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{

    function save_department(Request $request)
    {
        try {
            return response()->json([
                'succcess' => true,
                'data' => '',
                'message' => 'Department Details Saved Successfullu!',
            ]);
        } catch (\Throwable $th) {
            //throw $th;
        }
    }
}
