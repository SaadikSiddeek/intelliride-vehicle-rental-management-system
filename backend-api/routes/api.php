<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\InputFiltersController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::controller(UserController::class)->group(function () {
        Route::post('/save_user', 'createUser');
        Route::post('/get_users', 'getUsers');
        Route::post('/fetch_user_data', 'fetchUserData');
    });

    Route::controller(StaffController::class)->group(function () {
        Route::post('/save_staff', 'saveStaff');
        Route::post('/get_staff', 'getStaff');
        Route::post('/fetch_staff_data', 'fetchStaffData');
    });

    Route::controller(RoleController::class)->group(function () {
        Route::post('/save_role', 'saveRole');
    });

    Route::controller(DepartmentController::class)->group(function () {
        Route::post('/save_department', 'save_department');
    });

    Route::controller(InputFiltersController::class)->group(function () {
        Route::post('/branch_filter', 'branchFilter');
    });

    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::post('/signup', [AuthController::class, 'signup']);
Route::post('/login', [AuthController::class, 'login']);
