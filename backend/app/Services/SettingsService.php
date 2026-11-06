<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Schema;

/**
 * Key/value application settings with typed defaults. Controls behaviour the
 * user can toggle from the Settings page (depreciation posting mode, the disk
 * uploaded files are stored on, ...).
 */
class SettingsService
{
    /** @var array<int, string> */
    public const TIMEZONES = [
        'Asia/Jakarta',
        'Asia/Makassar',
        'Asia/Jayapura',
        'Asia/Singapore',
        'UTC',
    ];

    public const DEFAULTS = [
        'depreciation.mode' => 'auto_post', // auto_post | draft
        'storage.disk' => 'public',         // public | s3 | ...
        // General app settings.
        'general.timezone' => 'Asia/Jakarta',
        'general.date_format' => 'd F Y',
        // Per-economic-event Akunta sync toggles (default on).
        'sync.acquisition' => '1',
        'sync.depreciation' => '1',
        'sync.disposal' => '1',
        // Auto-prune retention for the economic-event queue.
        'retention.trashed_months' => '3',
        'retention.accepted_years' => '2',
        // Entity switcher: ids toggled off (not selectable) + the default entity.
        'entities.disabled_ids' => '[]',
        'entities.default_id' => '',
    ];

    public const SYNC_EVENTS = ['acquisition', 'depreciation', 'disposal'];

    public function get(string $key, mixed $default = null): mixed
    {
        $fallback = $default ?? (self::DEFAULTS[$key] ?? null);
        if (! Schema::hasTable('app_settings')) {
            return $fallback;
        }

        $value = AppSetting::query()->whereKey($key)->value('value');

        return $value ?? $fallback;
    }

    public function set(string $key, mixed $value): void
    {
        AppSetting::query()->updateOrCreate(['key' => $key], ['value' => (string) $value]);
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        $stored = Schema::hasTable('app_settings')
            ? AppSetting::query()->pluck('value', 'key')->all()
            : [];

        return array_merge(self::DEFAULTS, $stored);
    }

    public function depreciationMode(): string
    {
        $mode = (string) $this->get('depreciation.mode');

        return in_array($mode, ['auto_post', 'draft'], true) ? $mode : 'auto_post';
    }

    /** Whether a given economic event ('acquisition'|'depreciation'|'disposal') syncs to Akunta. */
    public function syncEnabled(string $source): bool
    {
        $value = $this->get('sync.'.$source, true);
        if (is_bool($value)) {
            return $value;
        }

        return ! in_array(strtolower(trim((string) $value)), ['0', 'false', 'off', 'no', ''], true);
    }

    /** @return array<string, bool> */
    public function syncSettings(): array
    {
        $out = [];
        foreach (self::SYNC_EVENTS as $event) {
            $out[$event] = $this->syncEnabled($event);
        }

        return $out;
    }

    public function timezone(): string
    {
        $tz = trim((string) $this->get('general.timezone'));

        return in_array($tz, self::TIMEZONES, true) ? $tz : 'Asia/Jakarta';
    }

    public function dateFormat(): string
    {
        $fmt = trim((string) $this->get('general.date_format'));

        return $fmt !== '' ? $fmt : 'd F Y';
    }

    /** @return array{timezone: string, date_format: string} */
    public function generalSettings(): array
    {
        return ['timezone' => $this->timezone(), 'date_format' => $this->dateFormat()];
    }

    /** Months a Trashed queue item is kept before the prune cron deletes it. */
    public function retentionTrashedMonths(): int
    {
        return max(0, (int) $this->get('retention.trashed_months', 3));
    }

    /** Years an accepted queue item is kept before the prune cron deletes it. */
    public function retentionAcceptedYears(): int
    {
        return max(0, (int) $this->get('retention.accepted_years', 2));
    }

    /** @return array{trashed_months: int, accepted_years: int} */
    public function retentionSettings(): array
    {
        return [
            'trashed_months' => $this->retentionTrashedMonths(),
            'accepted_years' => $this->retentionAcceptedYears(),
        ];
    }

    /**
     * Entity ids toggled OFF in settings (not selectable in the switcher).
     *
     * @return array<int, string>
     */
    public function entityDisabledIds(): array
    {
        $raw = $this->get('entities.disabled_ids', '[]');
        $ids = is_array($raw) ? $raw : json_decode((string) $raw, true);

        return is_array($ids) ? array_values(array_filter(array_map('strval', $ids))) : [];
    }

    /** @param array<int, string> $ids */
    public function setEntityDisabledIds(array $ids): void
    {
        $this->set('entities.disabled_ids', json_encode(array_values(array_unique($ids))));
    }

    /** The entity selected by default when none is remembered (or null → first enabled). */
    public function entityDefaultId(): ?string
    {
        $id = trim((string) $this->get('entities.default_id', ''));

        return $id !== '' ? $id : null;
    }

    public function setEntityDefaultId(?string $id): void
    {
        $this->set('entities.default_id', (string) ($id ?? ''));
    }

    /** Disk uploaded files are written to (falls back to a disk that exists). */
    public function storageDisk(): string
    {
        $disk = (string) $this->get('storage.disk');

        return config("filesystems.disks.$disk") ? $disk : 'public';
    }
}
