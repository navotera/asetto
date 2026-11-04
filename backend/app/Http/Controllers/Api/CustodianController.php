<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Custodian;
use App\Models\User;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustodianController extends Controller
{
    public function index(): JsonResponse
    {
        $custodians = Custodian::query()->with('user:id,name,main_tier_user_id')->orderBy('code')->get()
            ->map(fn (Custodian $c) => Present::custodian($c));

        return response()->json($custodians);
    }

    /**
     * Link a person-custodian to a shadow user. Resolution prefers the Ecopa
     * user UUID (main_tier_user_id); user_id (local ULID) is used when picking
     * from the synced list. Pass nulls to unlink.
     */
    public function link(Request $request, Custodian $custodian): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'string'],
            'ecopa_user_id' => ['nullable', 'string'],
        ]);

        $user = null;
        if (! empty($data['ecopa_user_id'])) {
            $user = User::query()->where('main_tier_user_id', $data['ecopa_user_id'])->first();
        }
        if (! $user && ! empty($data['user_id'])) {
            $user = User::query()->find($data['user_id']);
        }

        $custodian->user_id = $user?->id;
        $custodian->save();

        return response()->json(Present::custodian($custodian->load('user:id,name,main_tier_user_id')));
    }
}
