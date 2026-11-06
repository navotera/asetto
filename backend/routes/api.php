<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustodianController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepreciationController;
use App\Http\Controllers\Api\AssetImportController;
use App\Http\Controllers\Api\DisposalController;
use App\Http\Controllers\Api\EcopaRegistrationController;
use App\Http\Controllers\Api\EntityController;
use App\Http\Controllers\Api\JournalController;
use App\Http\Controllers\Api\PermissionMatrixController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\RoleManagementController;
use App\Http\Controllers\Api\SchedulerHealthController;
use App\Http\Controllers\Api\SettingsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| First-access registration wizard (public, pre-login)
|--------------------------------------------------------------------------
| The browser submits only Ecopa URL + Registration Token; the backend calls
| Ecopa and the token never returns to the SPA.
*/
Route::prefix('integration')->group(function () {
    Route::get('status', [EcopaRegistrationController::class, 'status']);
    Route::post('register', [EcopaRegistrationController::class, 'register']);
    Route::post('register/cancel', [EcopaRegistrationController::class, 'cancel']);
});

/*
|--------------------------------------------------------------------------
| SPA cookie auth (Sanctum stateful) — web/
|--------------------------------------------------------------------------
| `web` loads the cookie session; statefulApi() in bootstrap/app.php promotes
| first-party calls from configured Sanctum domains so `auth:sanctum` resolves
| the session user. Paths mirror web/src/api/mock/handlers.ts exactly: the SPA
| calls `${API_BASE}/api<path>`, so swapping mock→live is a config change only.
*/
Route::middleware(['web', 'auth:sanctum'])->group(function () {
    // Any authenticated user.
    Route::get('me', [BootstrapController::class, 'me']);
    Route::get('assets/mine', [AssetController::class, 'mine'])->middleware('perm:asset.read_own');
    // Must stay ungated: during impersonation the acting user is the (non-admin) target.
    Route::post('role-management/stop-impersonation', [RoleManagementController::class, 'stopImpersonation']);

    // Read (asset managers / admin).
    Route::middleware('perm:asset.read')->group(function () {
        Route::get('dashboard', [DashboardController::class, 'show']);
        Route::get('categories', [CategoryController::class, 'index']);
        Route::get('custodians', [CustodianController::class, 'index']);
        Route::get('entities', [EntityController::class, 'index']);
        Route::get('assets', [AssetController::class, 'index']);
        Route::get('assets/{asset}', [AssetController::class, 'show']);
        Route::get('assets/{asset}/custody-history', [AssetController::class, 'custodyHistory']);
        Route::get('assets/{asset}/depreciation', [AssetController::class, 'depreciationHistory']);
        Route::get('assets/{asset}/audit', [AssetController::class, 'auditTrail']);
        Route::get('assets/{asset}/journals', [AssetController::class, 'journals']);
        Route::get('assets/{asset}/photos', [PhotoController::class, 'index']);
        Route::get('assets/{asset}/purchase', [PurchaseController::class, 'show']);
        Route::get('depreciation/pending', [DepreciationController::class, 'pending']);
        Route::get('depreciation/report', [DepreciationController::class, 'report']);
        Route::get('depreciation/report/{category}', [DepreciationController::class, 'reportCategory']);
        Route::get('depreciation/preview', [DepreciationController::class, 'preview']);
        Route::get('depreciation/runs', [DepreciationController::class, 'index']);
        Route::get('depreciation/runs/{run}', [DepreciationController::class, 'show']);
        Route::get('disposals', [DisposalController::class, 'index']);
    });

    // Manage assets.
    Route::middleware('perm:asset.manage')->group(function () {
        Route::post('categories', [CategoryController::class, 'store']);
        Route::patch('categories/{category}', [CategoryController::class, 'update']);
        Route::delete('categories/{category}', [CategoryController::class, 'destroy']);
        Route::post('assets', [AssetController::class, 'store']);
        Route::post('assets/import', [AssetImportController::class, 'import']);
        Route::patch('assets/{asset}', [AssetController::class, 'update']);
        Route::delete('assets/{asset}', [AssetController::class, 'destroy']);
        Route::post('assets/{asset}/restore', [AssetController::class, 'restore'])->withTrashed();
        Route::post('assets/{asset}/condition', [AssetController::class, 'setCondition']);
        Route::post('assets/{asset}/reassign', [AssetController::class, 'reassign']);
        Route::post('assets/{asset}/photos', [PhotoController::class, 'store']);
        Route::delete('photos/{photo}', [PhotoController::class, 'destroy']);
        Route::post('assets/{asset}/purchase', [PurchaseController::class, 'upsert']);
    });

    // Depreciation runs + disposals + journal outbox.
    Route::post('depreciation/runs', [DepreciationController::class, 'post'])->middleware('perm:depreciation.run');
    Route::post('depreciation/runs/{run}/commit', [DepreciationController::class, 'commit'])->middleware('perm:depreciation.run');
    Route::post('disposals', [DisposalController::class, 'store'])->middleware('perm:disposal.manage');
    Route::middleware('perm:journal.read')->group(function () {
        Route::get('journals', [JournalController::class, 'index']);
        Route::get('journals/{journal}', [JournalController::class, 'show']);
        Route::post('journals/{journal}/retry', [JournalController::class, 'retry']);
        Route::post('journals/{journal}/trash', [JournalController::class, 'trash']);
    });

    // Admin: settings, custodian linking, role management, permission matrix.
    Route::middleware('perm:settings.manage')->group(function () {
        Route::get('settings', [SettingsController::class, 'show']);
        Route::put('settings', [SettingsController::class, 'update']);
        Route::get('scheduler/health', [SchedulerHealthController::class, 'index']);
        Route::patch('custodians/{custodian}', [CustodianController::class, 'link']);
        Route::post('entities', [EntityController::class, 'store']);

        Route::get('role-management', [RoleManagementController::class, 'index']);
        Route::post('role-management/assign', [RoleManagementController::class, 'assign']);
        Route::patch('role-management/{assignmentId}', [RoleManagementController::class, 'update']);
        Route::post('role-management/{assignmentId}/impersonate', [RoleManagementController::class, 'impersonate']);

        Route::get('permission-matrix', [PermissionMatrixController::class, 'show']);
        Route::put('permission-matrix/{roleCode}', [PermissionMatrixController::class, 'update']);
    });
});
