<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use Akunta\Rbac\Models\Entity;
use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Support\AssetAudit;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Bulk asset import from a spreadsheet. The SPA parses the uploaded Excel/CSV
 * file in the browser (SheetJS) and posts the rows here as JSON; this endpoint
 * is the authoritative validator + writer. `commit:false` is a dry run that
 * returns a per-row preview (resolve names → ids, collect errors) without
 * touching the database; `commit:true` creates every valid row and reports the
 * skipped ones. The exported file is a valid template for this importer.
 */
class AssetImportController extends Controller
{
    /** Accepted spreadsheet labels (lowercased) → depreciation method enum. */
    private const METHOD_LABELS = [
        'garis lurus' => 'straight_line',
        'straight_line' => 'straight_line',
        'saldo menurun' => 'declining_balance',
        'declining_balance' => 'declining_balance',
        'tidak didepresiasi' => 'none',
        'tanpa depresiasi' => 'none',
        'none' => 'none',
    ];

    /** Accepted spreadsheet labels (lowercased) → condition enum. */
    private const CONDITION_LABELS = [
        'baik' => 'good',
        'good' => 'good',
        'perlu perbaikan' => 'needs_repair',
        'needs_repair' => 'needs_repair',
        'rusak' => 'broken',
        'broken' => 'broken',
        'tidak terpakai' => 'idle',
        'idle' => 'idle',
    ];

    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1', 'max:2000'],
            'commit' => ['sometimes', 'boolean'],
        ]);

        $commit = (bool) ($request->boolean('commit'));
        $rows = $validated['rows'];

        $entities = Entity::query()->get();
        $categories = AssetCategory::query()->get();

        // Codes already taken, so we can flag duplicates (in the DB and within
        // the uploaded batch itself).
        $existingCodes = Asset::query()->pluck('code')->map(fn ($c) => mb_strtolower((string) $c))->flip();
        $seenCodes = [];

        $results = [];
        foreach (array_values($rows) as $i => $raw) {
            $raw = is_array($raw) ? $raw : [];
            [$data, $errors] = $this->resolveRow($raw, $entities, $categories);

            // Code uniqueness (only when a code was supplied; blank codes are
            // auto-generated at commit time and never collide).
            $code = isset($data['code']) ? mb_strtolower((string) $data['code']) : '';
            if ($code !== '') {
                if ($existingCodes->has($code)) {
                    $errors[] = 'Kode sudah dipakai aset lain.';
                } elseif (isset($seenCodes[$code])) {
                    $errors[] = 'Kode ganda di dalam berkas (baris '.($seenCodes[$code] + 1).').';
                } else {
                    $seenCodes[$code] = $i;
                }
            }

            $results[] = [
                'row' => $i + 1,
                'input' => $raw,
                'name' => $data['name'] ?? ($raw['name'] ?? ''),
                'resolved' => $data,
                'errors' => $errors,
                'valid' => $errors === [],
            ];
        }

        $valid = array_values(array_filter($results, fn ($r) => $r['valid']));
        $summary = [
            'total' => count($results),
            'valid' => count($valid),
            'invalid' => count($results) - count($valid),
        ];

        if (! $commit) {
            return response()->json([
                'committed' => false,
                'summary' => $summary,
                'rows' => $results,
            ]);
        }

        $created = 0;
        DB::transaction(function () use ($valid, &$created): void {
            foreach ($valid as $r) {
                $data = $r['resolved'];
                $data['code'] = $data['code'] ?: $this->nextCode();
                $data['status'] = 'active';
                $data['accumulated_depreciation'] = 0;

                $asset = Asset::query()->create($data);
                AssetAudit::log($asset->id, 'imported', 'Aset diimpor dari berkas.');
                $created++;
            }
        });

        return response()->json([
            'committed' => true,
            'created' => $created,
            'skipped' => $summary['invalid'],
            'summary' => $summary,
            'rows' => $results,
        ]);
    }

    /**
     * Resolve one raw spreadsheet row into a validated attribute array.
     *
     * @param  array<string, mixed>  $raw
     * @param  Collection<int, Entity>  $entities
     * @param  Collection<int, AssetCategory>  $categories
     * @return array{0: array<string, mixed>, 1: array<int, string>}
     */
    private function resolveRow(array $raw, Collection $entities, Collection $categories): array
    {
        $errors = [];
        $data = [];

        $get = fn (string $key) => trim((string) ($raw[$key] ?? ''));

        // code (optional)
        $data['code'] = $get('code');

        // name (required)
        $name = $get('name');
        if ($name === '') {
            $errors[] = 'Nama aset wajib diisi.';
        }
        $data['name'] = $name;

        // entity (required) — match by id or name (case-insensitive)
        $entityText = $get('entity');
        if ($entityText === '') {
            $errors[] = 'Entitas wajib diisi.';
        } else {
            $entity = $entities->first(fn (Entity $e) => $e->id === $entityText
                || mb_strtolower($e->name) === mb_strtolower($entityText));
            if (! $entity) {
                $errors[] = "Entitas \"{$entityText}\" tidak dikenal.";
            } else {
                $data['entity_id'] = $entity->id;
            }
        }

        // category (required) — match by code or name (case-insensitive)
        $categoryText = $get('category');
        if ($categoryText === '') {
            $errors[] = 'Kategori wajib diisi.';
        } else {
            $category = $categories->first(fn (AssetCategory $c) => $c->id === $categoryText
                || mb_strtolower((string) $c->code) === mb_strtolower($categoryText)
                || mb_strtolower($c->name) === mb_strtolower($categoryText));
            if (! $category) {
                $errors[] = "Kategori \"{$categoryText}\" tidak dikenal.";
            } else {
                $data['category_id'] = $category->id;
            }
        }

        // acquisition_date (required)
        $dateText = $get('acquisition_date');
        if ($dateText === '') {
            $errors[] = 'Tanggal perolehan wajib diisi.';
        } else {
            $date = $this->parseDate($dateText);
            if (! $date) {
                $errors[] = "Tanggal perolehan \"{$dateText}\" tidak valid (gunakan YYYY-MM-DD).";
            } else {
                $data['acquisition_date'] = $date;
            }
        }

        // acquisition_cost (required, >= 0)
        $costText = $get('acquisition_cost');
        if ($costText === '') {
            $errors[] = 'Nilai perolehan wajib diisi.';
        } else {
            $cost = $this->parseAmount($costText);
            if ($cost === null || $cost < 0) {
                $errors[] = "Nilai perolehan \"{$costText}\" tidak valid.";
            } else {
                $data['acquisition_cost'] = $cost;
            }
        }

        // salvage_value (optional, default 0)
        $salvageText = $get('salvage_value');
        if ($salvageText === '') {
            $data['salvage_value'] = 0;
        } else {
            $salvage = $this->parseAmount($salvageText);
            if ($salvage === null || $salvage < 0) {
                $errors[] = "Nilai residu \"{$salvageText}\" tidak valid.";
            } else {
                $data['salvage_value'] = $salvage;
            }
        }

        // useful_life_months (optional, default 60)
        $lifeText = $get('useful_life_months');
        if ($lifeText === '') {
            $data['useful_life_months'] = 60;
        } else {
            $life = (int) $this->parseAmount($lifeText);
            if ($life < 1) {
                $errors[] = "Masa manfaat \"{$lifeText}\" tidak valid.";
            } else {
                $data['useful_life_months'] = $life;
            }
        }

        // method (optional, default straight_line)
        $methodText = $get('method');
        if ($methodText === '') {
            $data['method'] = 'straight_line';
        } elseif ($m = (self::METHOD_LABELS[mb_strtolower($methodText)] ?? null)) {
            $data['method'] = $m;
        } else {
            $errors[] = "Metode \"{$methodText}\" tidak dikenal (Garis Lurus / Saldo Menurun / Tidak Didepresiasi).";
        }

        // condition (optional, default good)
        $conditionText = $get('condition');
        if ($conditionText === '') {
            $data['condition'] = 'good';
        } elseif ($c = (self::CONDITION_LABELS[mb_strtolower($conditionText)] ?? null)) {
            $data['condition'] = $c;
        } else {
            $errors[] = "Kondisi \"{$conditionText}\" tidak dikenal (Baik / Perlu Perbaikan / Rusak / Tidak Terpakai).";
        }

        $data['location'] = $get('location');
        $data['serial_number'] = $get('serial_number') ?: null;
        $data['notes'] = $get('notes') ?: null;

        return [$data, $errors];
    }

    /** Parse a date cell (ISO, dd/mm/yyyy, or dd-mm-yyyy) to Y-m-d, or null. */
    private function parseDate(string $text): ?string
    {
        $text = trim($text);

        // ISO yyyy-mm-dd (also accepts a datetime prefix from Excel).
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $text, $m)) {
            return $this->validDate((int) $m[1], (int) $m[2], (int) $m[3]);
        }
        // dd/mm/yyyy or dd-mm-yyyy
        if (preg_match('#^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$#', $text, $m)) {
            return $this->validDate((int) $m[3], (int) $m[2], (int) $m[1]);
        }

        return null;
    }

    private function validDate(int $y, int $mo, int $d): ?string
    {
        if (! checkdate($mo, $d, $y)) {
            return null;
        }

        return CarbonImmutable::create($y, $mo, $d)->format('Y-m-d');
    }

    /** Parse a rupiah/integer amount: strip "Rp", spaces and thousand dots. */
    private function parseAmount(string $text): ?float
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }
        // Keep only digits and a single leading minus — asset values are whole
        // rupiah; thousand separators and "Rp" are discarded.
        $clean = preg_replace('/[^0-9-]/', '', $text);
        if ($clean === '' || $clean === '-') {
            return null;
        }

        return (float) $clean;
    }

    private function nextCode(): string
    {
        do {
            $n = Asset::query()->count() + 1;
            $code = 'AST-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
            // Guard against a gap/custom code already holding this number.
            $exists = Asset::query()->where('code', $code)->exists();
            if ($exists) {
                // Fall back to a timestamped code to break the collision.
                $code = 'AST-'.now()->format('ymdHis').'-'.random_int(100, 999);
            }
        } while (Asset::query()->where('code', $code)->exists());

        return $code;
    }
}
