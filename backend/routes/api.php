<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustodianController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepreciationController;
use App\Http\Controllers\Api\DisposalController;
use App\Http\Controllers\Api\EcopaRegistrationController;
use App\Http\Controllers\Api\JournalController;
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
    Route::get('me', [BootstrapController::class, 'me']);

    Route::get('dashboard', [DashboardController::class, 'show']);

    Route::get('categories', [CategoryController::class, 'index']);
    Route::get('custodians', [CustodianController::class, 'index']);

    Route::get('assets', [AssetController::class, 'index']);
    Route::post('assets', [AssetController::class, 'store']);
    Route::get('assets/{asset}', [AssetController::class, 'show']);
    Route::patch('assets/{asset}', [AssetController::class, 'update']);
    Route::delete('assets/{asset}', [AssetController::class, 'destroy']);
    Route::post('assets/{asset}/condition', [AssetController::class, 'setCondition']);
    Route::post('assets/{asset}/reassign', [AssetController::class, 'reassign']);

    Route::get('depreciation/pending', [DepreciationController::class, 'pending']);
    Route::get('depreciation/preview', [DepreciationController::class, 'preview']);
    Route::get('depreciation/runs', [DepreciationController::class, 'index']);
    Route::get('depreciation/runs/{run}', [DepreciationController::class, 'show']);
    Route::post('depreciation/runs', [DepreciationController::class, 'post']);

    Route::get('disposals', [DisposalController::class, 'index']);
    Route::post('disposals', [DisposalController::class, 'store']);

    Route::get('journals', [JournalController::class, 'index']);
    Route::get('journals/{journal}', [JournalController::class, 'show']);
    Route::post('journals/{journal}/retry', [JournalController::class, 'retry']);
});
