<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Custodian;
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
    /** @return array<string, mixed> */
    public static function asset(Asset $asset): array
    {
        $cost = (float) $asset->acquisition_cost;
        $accum = (float) $asset->accumulated_depreciation;

        return [
            'id' => $asset->id,
            'code' => $asset->code,
            'name' => $asset->name,
            'category_id' => $asset->category_id,
            'acquisition_date' => self::date($asset->acquisition_date),
            'acquisition_cost' => $cost,
            'salvage_value' => (float) $asset->salvage_value,
            'useful_life_months' => (int) $asset->useful_life_months,
            'method' => $asset->method,
            'condition' => $asset->condition,
            'custodian_id' => $asset->custodian_id,
            'location' => $asset->location,
            'serial_number' => $asset->serial_number,
            'notes' => $asset->notes,
            'status' => $asset->status,
            'accumulated_depreciation' => $accum,
            'book_value' => max(0.0, $cost - $accum),
            'last_depreciated_period' => $asset->last_depreciated_period,
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
            'akunta_asset_account' => $c->akunta_asset_account,
            'akunta_accum_dep_account' => $c->akunta_accum_dep_account,
            'akunta_dep_expense_account' => $c->akunta_dep_expense_account,
        ];
    }

    /** @return array<string, mixed> */
    public static function custodian(Custodian $c): array
    {
        return array_filter([
            'id' => $c->id,
            'type' => $c->type,
            'code' => $c->code,
            'name' => $c->name,
            'department' => $c->department,
        ], fn ($v) => $v !== null);
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
        $lines = array_map(fn (array $l) => [
            'account_code' => $l['account_code'] ?? '',
            'account_name' => $l['account_name'] ?? '',
            'debit' => (float) ($l['debit'] ?? 0),
            'credit' => (float) ($l['credit'] ?? 0),
        ], (array) $j->lines);

        return [
            'id' => $j->id,
            'idempotency_key' => $j->idempotency_key,
            'source' => $j->source,
            'source_ref' => $j->source_ref,
            'date' => self::date($j->date),
            'memo' => $j->memo,
            'status' => $j->status,
            'akunta_journal_no' => $j->akunta_journal_no,
            'lines' => $lines,
            'created_at' => self::iso($j->created_at),
            'posted_at' => self::iso($j->posted_at),
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
