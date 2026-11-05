<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}

    public function show(): JsonResponse
    {
        return response()->json($this->payload());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mode' => ['sometimes', Rule::in(['auto_post', 'draft'])],
            'disk' => ['sometimes', 'string', 'max:32'],
            'sync' => ['sometimes', 'array'],
            'sync.acquisition' => ['sometimes', 'boolean'],
            'sync.depreciation' => ['sometimes', 'boolean'],
            'sync.disposal' => ['sometimes', 'boolean'],
            'retention' => ['sometimes', 'array'],
            'retention.trashed_months' => ['sometimes', 'integer', 'min:0', 'max:120'],
            'retention.accepted_years' => ['sometimes', 'integer', 'min:0', 'max:50'],
            'general' => ['sometimes', 'array'],
            'general.timezone' => ['sometimes', Rule::in(SettingsService::TIMEZONES)],
            'general.date_format' => ['sometimes', 'string', 'max:32'],
        ]);

        if (isset($data['mode'])) {
            $this->settings->set('depreciation.mode', $data['mode']);
        }
        if (isset($data['disk'])) {
            $this->settings->set('storage.disk', $data['disk']);
        }
        foreach (($data['sync'] ?? []) as $event => $enabled) {
            if (in_array($event, SettingsService::SYNC_EVENTS, true)) {
                $this->settings->set('sync.'.$event, $enabled ? '1' : '0');
            }
        }
        if (isset($data['retention']['trashed_months'])) {
            $this->settings->set('retention.trashed_months', (string) (int) $data['retention']['trashed_months']);
        }
        if (isset($data['retention']['accepted_years'])) {
            $this->settings->set('retention.accepted_years', (string) (int) $data['retention']['accepted_years']);
        }
        if (isset($data['general']['timezone'])) {
            $this->settings->set('general.timezone', (string) $data['general']['timezone']);
        }
        if (isset($data['general']['date_format'])) {
            $this->settings->set('general.date_format', (string) $data['general']['date_format']);
        }

        return response()->json($this->payload());
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        return [
            'mode' => $this->settings->depreciationMode(),
            'disk' => (string) $this->settings->get('storage.disk'),
            'disks' => array_values(array_keys(config('filesystems.disks', []))),
            'sync' => $this->settings->syncSettings(),
            'retention' => $this->settings->retentionSettings(),
            'general' => $this->settings->generalSettings(),
            'timezones' => SettingsService::TIMEZONES,
        ];
    }
}
