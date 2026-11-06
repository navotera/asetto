<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetPhoto;
use App\Models\AssetPurchase;
use App\Models\Custodian;
use App\Models\CustodyHandover;
use App\Models\DepreciationLine;
use App\Models\DepreciationRun;
use App\Models\Disposal;
use App\Models\JournalOutbox;

/**
 * Serializers that produce exactly the JSON shapes the SPA's TypeScript types
 * expect (web/src/api/types.ts) — numbers as numbers (not decimal strings),
 * dates as YYYY-MM-DD, timestamps as ISO-8601.
 */
class Present
{
    /**
     * @param  bool  $withValues  when false, monetary fields are nulled out and
     *                            `values_hidden` is set (for users lacking asset.view_value).
     * @return array<string, mixed>
     */
    public static function asset(Asset $asset, bool $withValues = true): array
    {
        $cost = (float) $asset->acquisition_cost;
        $accum = (float) $asset->accumulated_depreciation;

        return [
            'id' => $asset->id,
            'code' => $asset->code,
            'name' => $asset->name,
            'entity_id' => $asset->entity_id,
            'category_id' => $asset->category_id,
            'acquisition_date' => self::date($asset->acquisition_date),
            'acquisition_cost' => $withValues ? $cost : null,
            'salvage_value' => $withValues ? (float) $asset->salvage_value : null,
            'useful_life_months' => (int) $asset->useful_life_months,
            'method' => $asset->method,
            'condition' => $asset->condition,
            'custodian_id' => $asset->custodian_id,
            'location' => $asset->location,
            'serial_number' => $asset->serial_number,
            'notes' => $asset->notes,
            'status' => $asset->status,
            'sync_akunta' => (bool) $asset->sync_akunta,
            'trashed' => $asset->trashed(),
            'accumulated_depreciation' => $withValues ? $accum : null,
            'book_value' => $withValues ? max(0.0, $cost - $accum) : null,
            'last_depreciated_period' => $asset->last_depreciated_period,
            'values_hidden' => ! $withValues,
        ];
    }

    /** @return array<string, mixed> */
    public static function category(AssetCategory $c): array
    {
        return [
            'id' => $c->id,
            'code' => $c->code,
            'name' => $c->name,
            'default_method' => $c->default_method,
            'default_useful_life_months' => (int) $c->default_useful_life_months,
            'asset_count' => $c->assets_count ?? null,
        ];
    }

    /** @return array<string, mixed> */
    public static function custodian(Custodian $c): array
    {
        return [
            'id' => $c->id,
            'type' => $c->type,
            'code' => $c->code,
            'name' => $c->name,
            'email' => $c->email,
            'department' => $c->department,
            'user_id' => $c->user_id,
            'ecopa_user_id' => $c->relationLoaded('user') ? $c->user?->main_tier_user_id : null,
            'user_name' => $c->relationLoaded('user') ? $c->user?->name : null,
        ];
    }

    /** @return array<string, mixed> */
    public static function run(DepreciationRun $run): array
    {
        $run->loadMissing('lines.asset.category');

        $lines = $run->lines->map(function ($line) {
            $asset = $line->asset;

            return [
                'asset_id' => $line->asset_id,
                'asset_code' => $asset?->code,
                'asset_name' => $asset?->name,
                'category_name' => $asset?->category?->name,
                'amount' => (float) $line->amount,
                'book_value_before' => (float) $line->book_value_before,
                'book_value_after' => (float) $line->book_value_after,
            ];
        })->all();

        return [
            'id' => $run->id,
            'period' => $run->period,
            'status' => $run->status,
            'total_amount' => (float) $run->total_amount,
            'lines' => $lines,
            'journal_id' => $run->journal_id,
            'created_at' => self::iso($run->created_at),
            'posted_at' => self::iso($run->posted_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function disposal(Disposal $d): array
    {
        $d->loadMissing('asset');

        return [
            'id' => $d->id,
            'asset_id' => $d->asset_id,
            'asset_code' => $d->asset?->code,
            'asset_name' => $d->asset?->name,
            'date' => self::date($d->date),
            'type' => $d->type,
            'proceeds' => (float) $d->proceeds,
            'book_value_at_disposal' => (float) $d->book_value_at_disposal,
            'gain_loss' => (float) $d->gain_loss,
            'journal_id' => $d->journal_id,
            'status' => $d->status,
        ];
    }

    /** @return array<string, mixed> */
    public static function journal(JournalOutbox $j): array
    {
        return [
            'id' => $j->id,
            'idempotency_key' => $j->idempotency_key,
            'source' => $j->source,
            'source_type' => $j->source_type,
            'source_ref' => $j->source_ref,
            'entity_id' => $j->entity_id,
            'date' => self::date($j->date),
            'memo' => $j->memo,
            'status' => $j->status,
            'akunta_raw_id' => $j->akunta_raw_id,
            'payload' => (array) $j->payload,
            'last_error' => $j->last_error,
            'created_at' => self::iso($j->created_at),
            'posted_at' => self::iso($j->posted_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function custodyHandover(CustodyHandover $h): array
    {
        return [
            'id' => $h->id,
            'from_custodian_id' => $h->from_custodian_id,
            'from_custodian_name' => $h->fromCustodian?->name,
            'to_custodian_id' => $h->to_custodian_id,
            'to_custodian_name' => $h->toCustodian?->name,
            'from_location' => $h->from_location,
            'to_location' => $h->to_location,
            'condition_at_handover' => $h->condition_at_handover,
            'notes' => $h->notes,
            'handed_at' => self::iso($h->handed_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function assetDepreciationLine(DepreciationLine $line): array
    {
        return [
            'period' => $line->run?->period,
            'status' => $line->run?->status,
            'amount' => (float) $line->amount,
            'book_value_before' => (float) $line->book_value_before,
            'book_value_after' => (float) $line->book_value_after,
            'journal_id' => $line->run?->journal_id,
            'posted_at' => self::iso($line->run?->posted_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function photo(AssetPhoto $p): array
    {
        return [
            'id' => $p->id,
            'url' => $p->url(),
            'thumb_url' => $p->thumbUrl(),
            'caption' => $p->caption,
            'width' => $p->width,
            'height' => $p->height,
            'taken_at' => self::iso($p->taken_at),
            'created_at' => self::iso($p->created_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function purchase(?AssetPurchase $p): ?array
    {
        if (! $p) {
            return null;
        }

        return [
            'id' => $p->id,
            'vendor' => $p->vendor,
            'invoice_no' => $p->invoice_no,
            'purchase_date' => self::date($p->purchase_date),
            'amount' => (float) $p->amount,
            'notes' => $p->notes,
            'proof_url' => $p->proofUrl(),
            'proof_thumb_url' => $p->proofThumbUrl(),
            'proof_type' => $p->proof_type,
        ];
    }

    private static function date(mixed $value): ?string
    {
        return $value?->format('Y-m-d');
    }

    private static function iso(mixed $value): ?string
    {
        return $value?->toIso8601String();
    }
}
