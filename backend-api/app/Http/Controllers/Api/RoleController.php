<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{

    public function saveRole(Request $request)
    {
        try {

            $upd_id = $request->input('upd_id');
            $form_data = $request->input('form_data');

            $validator = Validator::make(
                $request->input('form_data', []),
                [
                    'role_name' => [
                        'required',
                        'string',
                        'max:100',
                        Rule::unique('roles_tb', 'role_name')->ignore($upd_id),
                    ],
                    'role_description' => ['required', 'string', 'max:255'],
                    'status' => ['required', 'boolean'],
                ],
                [
                    'role_name.required' => 'Role name is required',
                    'role_name.unique' => 'This role name already exists',
                    'role_description.required' => 'Description is required',
                ]
            );

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $data = [
                'role_name' => $form_data['role_name'],
                'description' => $form_data['role_description'],
                'status' => $form_data['status'] === true ? 1 : 0,
                'branch_id' => 1
            ];

            if (!empty($upd_id)) {
                DB::table('roles_tb')->where('ID', $upd_id)->update($data);
            } else {
                DB::table('roles_tb')->insert($data);
            }

            return response()->json([
                'success' => true,
                'message' => 'Role has been inserted Successfully!',
            ]);


        } catch (\Throwable $th) {
            return response()->json([
                'status' => false,
                'message' => $th->getMessage(),
            ], 500);
        }
    }

}