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
    public const DEFAULTS = [
        'depreciation.mode' => 'auto_post', // auto_post | draft
        'storage.disk' => 'public',         // public | s3 | ...
    ];

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

    /** Disk uploaded files are written to (falls back to a disk that exists). */
    public function storageDisk(): string
    {
        $disk = (string) $this->get('storage.disk');

        return config("filesystems.disks.$disk") ? $disk : 'public';
    }
}
