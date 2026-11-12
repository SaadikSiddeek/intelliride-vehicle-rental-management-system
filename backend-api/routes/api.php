<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InvoiceOutputController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\FleetOperationsController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\ReturnController;
use App\Http\Controllers\Api\RentalController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\DesignationController;
use App\Http\Controllers\Api\InputFiltersController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VehicleCategoryController;
use App\Http\Controllers\Api\VehicleBrandController;
use App\Http\Controllers\Api\FuelTypeController;
use App\Http\Controllers\Api\VehicleTransmissionController;
use App\Http\Controllers\Api\VehicleFeaturesController;
use App\Http\Controllers\Api\VehicleModelsController;
use App\Http\Controllers\Api\RegisterVehicleController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\RentalPackageController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active.account'])->group(function () {
    Route::get('/business_profile', [\App\Http\Controllers\Api\BusinessProfileController::class,'show']);
    Route::post('/save_business_profile', [\App\Http\Controllers\Api\BusinessProfileController::class,'save']);
    Route::get('/business_branding', [\App\Http\Controllers\Api\BusinessProfileController::class,'branding']);
    Route::post('/my_profile_photo', [\App\Http\Controllers\Api\MyProfileController::class,'save']);
    Route::get('/my_profile_photo', [\App\Http\Controllers\Api\MyProfileController::class,'photo']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::controller(UserController::class)->middleware('administration')->group(function () {
        Route::post('/save_user', 'createUser');
        Route::post('/get_users', 'getUsers');
        Route::post('/fetch_user_data', 'fetchUserData');
    });

    Route::controller(StaffController::class)->group(function () {
        Route::post('/save_staff', 'saveStaff');
        Route::post('/get_staff', 'getStaff');
        Route::post('/fetch_staff_data', 'fetchStaffData');
    });

    Route::controller(RoleController::class)->middleware('administration')->group(function () {
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

    Route::controller(FuelTypeController::class)->group(function () {
        Route::post('/save_fuel_type', 'saveFuelType');
        Route::post('/get_fuel_types', 'getFuelTypes');
        Route::post('/fetch_fuel_type_data', 'fetchFuelTypeData');
    });

    Route::controller(VehicleTransmissionController::class)->group(function () {
        Route::post('/save_vehicle_transmission', 'saveVehicleTransmission');
        Route::post('/get_vehicle_transmissions', 'getVehicleTransmissions');
        Route::post('/fetch_vehicle_transmission_data', 'fetchVehicleTransmissionData');
    });

    Route::controller(VehicleFeaturesController::class)->group(function () {
        Route::post('/save_vehicle_feature', 'saveVehicleFeature');
        Route::post('/get_vehicle_features', 'getVehicleFeatures');
        Route::post('/fetch_vehicle_feature_data', 'fetchVehicleFeatureData');
    });

    Route::controller(VehicleModelsController::class)->group(function () {
        Route::post('/save_vehicle_model', 'saveVehicleModel');
        Route::post('/get_vehicle_models', 'getVehicleModels');
        Route::post('/fetch_vehicle_model_data', 'fetchVehicleModelData');
    });

    Route::controller(RegisterVehicleController::class)->group(function () {
        Route::post('/save_vehicle', 'saveVehicle');
        Route::post('/get_vehicles', 'getVehicles');
        Route::post('/fetch_vehicle_data', 'fetchVehicleData');
    });

    Route::controller(BranchController::class)->group(function () {
        Route::post('/save_branch', 'saveBranch');
        Route::post('/get_branches', 'getBranches');
        Route::post('/fetch_branch_data', 'fetchBranchData');
        Route::post('/delete_branch', 'deleteBranch');
    });

    Route::post('/dashboard_overview', [\App\Http\Controllers\Api\DashboardController::class, 'overview']);
    Route::post('/invoice_output', [InvoiceOutputController::class, 'output']);

    Route::controller(ReportController::class)->group(function () {
        Route::post('/report_options', 'options');
        Route::post('/report_customer_filter', 'customerFilter');
        Route::post('/get_report', 'getReport');
        Route::post('/export_report', 'export');
    });

    Route::controller(FleetOperationsController::class)->group(function () {
        Route::post('/get_vehicle_documents', 'getDocuments');
        Route::post('/save_vehicle_document', 'saveDocument');
        Route::get('/vehicle_documents/{id}', 'downloadDocument')->whereNumber('id');
        Route::post('/get_maintenance', 'getMaintenance');
        Route::post('/save_maintenance', 'saveMaintenance');
        Route::post('/maintenance_status', 'maintenanceStatus');
    });

    Route::controller(FinanceController::class)->group(function () {
        Route::post('/invoice_filter', 'invoiceFilter');
        Route::post('/get_invoices', 'getInvoices');
        Route::post('/fetch_invoice_data', 'fetchInvoiceData');
        Route::post('/get_payments', 'getPayments');
        Route::post('/save_invoice_payment', 'savePayment');
        Route::post('/get_refunds', 'getRefunds');
        Route::post('/save_deposit_refund', 'saveRefund');
    });

    Route::controller(ReturnController::class)->group(function () {
        Route::post('/return_rental_filter', 'rentalFilter');
        Route::post('/save_return_assessment', 'saveAssessment');
        Route::post('/get_returns', 'getReturns');
        Route::post('/fetch_return_data', 'fetchReturnData');
        Route::post('/finalize_return', 'finalizeReturn');
    });

    Route::controller(RentalController::class)->group(function () {
        Route::post('/handover_booking_filter', 'bookingFilter');
        Route::post('/handover_context', 'handoverContext');
        Route::post('/save_handover', 'saveHandover');
        Route::post('/get_rentals', 'getRentals');
        Route::post('/fetch_rental_data', 'fetchRentalData');
        Route::get('/rental_photos/{id}', 'downloadPhoto')->whereNumber('id');
    });

    Route::controller(BookingController::class)->group(function () {
        Route::post('/booking_options', 'options');
        Route::post('/booking_vehicle_filter', 'vehicleFilter');
        Route::post('/booking_package_filter', 'packageFilter');
        Route::post('/quote_booking', 'quote');
        Route::post('/save_booking', 'saveBooking');
        Route::post('/get_bookings', 'getBookings');
        Route::post('/fetch_booking_data', 'fetchBookingData');
        Route::post('/booking_status', 'changeStatus');
    });

    Route::controller(CustomerController::class)->group(function () {
        Route::post('/save_customer', 'saveCustomer');
        Route::post('/get_customers', 'getCustomers');
        Route::post('/customer_filter', 'customerInputFilter');
        Route::post('/fetch_customer_data', 'fetchCustomerData');

        Route::get('/customer_documents/{id}', 'downloadDocument')
            ->whereNumber('id');
    });

    Route::controller(RentalPackageController::class)->group(function () {
        Route::post('/save_rental_package', 'saveRentalPackage');
        Route::post('/get_rental_packages', 'getRentalPackages');
        Route::post('/fetch_rental_package_data', 'fetchRentalPackageData');
        Route::post('/rental_package_vehicles', 'getPackageVehicles');
    });

    Route::controller(InputFiltersController::class)->group(function () {
        Route::post('/staff_filter', 'staffInputFilter');
        Route::post('/role_filter', 'roleInputFilter');

        Route::post('/branch_filter', 'branchInputFilter');
        Route::post('/department_filter', 'departmentInputFilter');
        Route::post('/designation_filter', 'designationInputFilter');
        Route::post('/fuel_type_filter', 'fuelTypeInputFilter');
        Route::post('/transmission_type_filter', 'transmissionTypeInputFilter');
        Route::post('/brand_filter', 'brandInputFilter');
        Route::post('/model_filter', 'modelInputFilter');
        Route::post('/vehciel_category_filter', 'vehicleCatInputFilter');
    });

    Route::post('/auth/activity', [AuthController::class, 'activity']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

// IMAGE FUNCTIONALITY: public vehicle photo display.
Route::get(
    '/registered-vehicle-images/{folder}/{filename}',
    [RegisterVehicleController::class, 'showImage']
)
    ->where('folder', 'vehicle_[1-9][0-9]*')
    ->where('filename', '[a-f0-9-]+\.(jpg|jpeg|png|webp)');

// IMAGE FUNCTIONALITY: public display of brand logos.
Route::get(
    '/vehicle-brand-images/{folder}/{filename}',
    [VehicleBrandController::class, 'showLogo']
)
    ->where('folder', '[a-z0-9-]+_[1-9][0-9]*')
    ->where('filename', '[a-f0-9-]+\.(jpg|jpeg|png|webp)');

Route::post('/signup', [AuthController::class, 'signup'])->middleware('throttle:6,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
