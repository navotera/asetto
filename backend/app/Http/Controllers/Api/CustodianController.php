<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Custodian;
use App\Support\Present;
use Illuminate\Http\JsonResponse;

class CustodianController extends Controller
{
    public function index(): JsonResponse
    {
        $custodians = Custodian::query()->orderBy('code')->get()
            ->map(fn (Custodian $c) => Present::custodian($c));

        return response()->json($custodians);
    }
}
