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
        ]);

        if (isset($data['mode'])) {
            $this->settings->set('depreciation.mode', $data['mode']);
        }
        if (isset($data['disk'])) {
            $this->settings->set('storage.disk', $data['disk']);
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
        ];
    }
}
