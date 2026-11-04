<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Asset;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Period-by-period depreciation math for the asset sub-ledger. Mirrors the
 * behaviour the SPA models in web/src/api/mock/db.ts so preview/pending/post
 * stay identical between mock and live modes.
 */
class DepreciationEngine
{
    /** Monthly depreciation for an asset at its current book value. */
    public function monthly(Asset $asset): float
    {
        if ($asset->method === 'none' || $asset->status === 'disposed') {
            return 0.0;
        }

        $cost = (float) $asset->acquisition_cost;
        $salvage = (float) $asset->salvage_value;
        $bookValue = $cost - (float) $asset->accumulated_depreciation;
        $remaining = $bookValue - $salvage;
        if ($remaining <= 0) {
            return 0.0;
        }

        $life = max(1, (int) $asset->useful_life_months);
        if ($asset->method === 'straight_line') {
            $amount = ($cost - $salvage) / $life;
        } else {
            // Double-declining on current book value, expressed monthly.
            $annualRate = 2 / ($life / 12);
            $amount = ($bookValue * $annualRate) / 12;
        }

        return (float) round(max(0.0, min($amount, $remaining)));
    }

    /** The next period (YYYY-MM) this asset is due for depreciation. */
    public function nextPeriodFor(Asset $asset): string
    {
        if (empty($asset->last_depreciated_period)) {
            return CarbonImmutable::parse($asset->acquisition_date)->format('Y-m');
        }

        [$y, $m] = array_map('intval', explode('-', $asset->last_depreciated_period));

        return CarbonImmutable::create($y, $m, 1)->addMonth()->format('Y-m');
    }

    /** Earliest period still holding at least one asset awaiting depreciation. */
    public function pendingPeriod(): ?string
    {
        $periods = $this->depreciableAssets()
            ->map(fn (Asset $a) => $this->nextPeriodFor($a))
            ->sort()
            ->values();

        return $periods->first();
    }

    /**
     * Build the per-asset lines due for a given period.
     *
     * @return array<int, array{asset: Asset, amount: float, book_value_before: float, book_value_after: float}>
     */
    public function buildLines(string $period): array
    {
        $lines = [];
        foreach (Asset::query()->where('status', 'active')->where('method', '!=', 'none')->get() as $asset) {
            if ($this->nextPeriodFor($asset) !== $period) {
                continue;
            }
            $amount = $this->monthly($asset);
            if ($amount <= 0) {
                continue;
            }
            $bookBefore = (float) $asset->acquisition_cost - (float) $asset->accumulated_depreciation;
            $lines[] = [
                'asset' => $asset,
                'amount' => $amount,
                'book_value_before' => $bookBefore,
                'book_value_after' => $bookBefore - $amount,
            ];
        }

        return $lines;
    }

    /** @return Collection<int, Asset> */
    private function depreciableAssets()
    {
        return Asset::query()
            ->where('status', 'active')
            ->where('method', '!=', 'none')
            ->get()
            ->filter(fn (Asset $a) => ((float) $a->acquisition_cost - (float) $a->accumulated_depreciation) > (float) $a->salvage_value)
            ->values();
    }
}
