<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\DesignationController;
use App\Http\Controllers\Api\InputFiltersController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VehicleCategoryController;
use App\Http\Controllers\Api\VehicleBrandController;
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
        Route::post('/get_roles', 'getRoles');
        Route::post('/fetch_role_data', 'fetchRoleData');
    });

    Route::controller(DepartmentController::class)->group(function () {
        Route::post('/save_department', 'saveDepartment');
        Route::post('/get_department', 'getDepartments');
        Route::post('/fetch_department_data', 'fetchDepartmentData');
    });

    Route::controller(DesignationController::class)->group(function () {
        Route::post('/save_designation', 'saveDesignation');
        Route::post('/get_designation', 'getDesignation');
        Route::post('/fetch_designation_data', 'fetchDesignationData');
    });

    Route::controller(VehicleCategoryController::class)->group(function () {
        Route::post('/save_vehicle_category', 'saveVehicleCategory');
        Route::post('/get_vehicle_categories', 'getVehicleCategories');
        Route::post('/fetch_vehicle_category_data', 'fetchVehicleCategoryData');
    });

    Route::controller(VehicleBrandController::class)->group(function () {
        Route::post('/save_vehicle_brand', 'saveVehicleBrand');
        Route::post('/get_vehicle_brands', 'getVehicleBrands');
        Route::post('/fetch_vehicle_brand_data', 'fetchVehicleBrandData');
    });

    Route::controller(InputFiltersController::class)->group(function () {
        Route::post('/branch_filter', 'branchFilter');
    });

    Route::post('/auth/activity', [AuthController::class, 'activity']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

// IMAGE FUNCTIONALITY: public display of brand logos.
Route::get(
    '/vehicle-brand-images/{folder}/{filename}',
    [VehicleBrandController::class, 'showLogo']
)
    ->where('folder', '[a-z0-9-]+_[1-9][0-9]*')
    ->where('filename', '[a-f0-9-]+\.(jpg|jpeg|png|webp)');

Route::post('/signup', [AuthController::class, 'signup']);
Route::post('/login', [AuthController::class, 'login']);
