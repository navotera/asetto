<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\AssetAuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/** Records one append-only activity entry for an asset. */
class AssetAudit
{
    public static function log(string $assetId, string $action, ?string $description = null): void
    {
        AssetAuditLog::query()->create([
            'id' => (string) Str::ulid(),
            'asset_id' => $assetId,
            'action' => $action,
            'description' => $description,
            'actor_user_id' => Auth::id(),
            'actor_name' => Auth::user()?->name,
            'created_at' => now(),
        ]);
    }
}
