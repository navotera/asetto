#requires -Version 5
<#
.SYNOPSIS
  Jalankan Asetto secara lokal untuk dicoba: backend Laravel + web SPA sekaligus.

.DESCRIPTION
  Menyiapkan dependency/DB bila belum ada, lalu menjalankan dua server di dua
  jendela PowerShell terpisah:
    - Backend (Laravel)  -> http://localhost:8090
    - Web SPA (Vite)     -> http://localhost:5180

  Secara default SPA berjalan mode MOCK (tanpa backend). Pakai -Live agar SPA
  memanggil backend sungguhan.

.PARAMETER Live
  Set SPA ke mode live (VITE_API_MODE=live, VITE_API_BASE=http://localhost:8000).

.PARAMETER Fresh
  migrate:fresh --seed (reset database backend) alih-alih migrate --seed.

.EXAMPLE
  .\serve.ps1
.EXAMPLE
  .\serve.ps1 -Live -Fresh
#>
param(
    [switch]$Live,
    [switch]$Fresh
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$web = Join-Path $root 'web'

# Composer Laragon dipakai karena Composer sistem (2.5.7) crash di PHP 8.5.
$composerPhar = 'C:\laragon\bin\composer\composer.phar'

function Invoke-Composer {
    param([string]$Cwd, [string[]]$Arguments)
    Push-Location $Cwd
    try {
        if (Test-Path $composerPhar) { & php $composerPhar @Arguments }
        else { & composer @Arguments }
        if ($LASTEXITCODE -ne 0) { throw "composer gagal (exit $LASTEXITCODE)" }
    }
    finally { Pop-Location }
}

# Set/replace satu baris KEY=value di file .env (pertahankan baris lain).
function Set-EnvVar {
    param([string]$EnvFile, [string]$Key, [string]$Value)
    $lines = @()
    if (Test-Path $EnvFile) {
        $lines = Get-Content $EnvFile | Where-Object { $_ -notmatch "^$([regex]::Escape($Key))=" }
    }
    $lines += "$Key=$Value"
    $lines | Set-Content -Path $EnvFile -Encoding utf8
}

# --- Backend -----------------------------------------------------------------
Write-Host '==> Menyiapkan backend (Laravel)...' -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $backend 'vendor'))) {
    Write-Host '    composer install...'
    Invoke-Composer $backend @('install', '--no-interaction')
}

if (-not (Test-Path (Join-Path $backend '.env'))) {
    Copy-Item (Join-Path $backend '.env.example') (Join-Path $backend '.env')
}

Push-Location $backend
try {
    if (-not (Select-String -Path '.env' -Pattern '^APP_KEY=.+' -Quiet)) {
        & php artisan key:generate --ansi
    }

    $sqlite = Join-Path $backend 'database\database.sqlite'
    if (-not (Test-Path $sqlite)) { New-Item -ItemType File -Path $sqlite | Out-Null }

    if ($Fresh) { & php artisan migrate:fresh --seed --no-interaction }
    else { & php artisan migrate --seed --no-interaction }

    # Symlink storage/app/public -> public/storage so uploaded photos/proofs are
    # served. Harmless if it already exists.
    & php artisan storage:link 2>$null
}
finally { Pop-Location }

# --- Web ---------------------------------------------------------------------
Write-Host '==> Menyiapkan web (SPA)...' -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $web 'node_modules'))) {
    Push-Location $web
    try { & npm install }
    finally { Pop-Location }
}

if ($Live) {
    # SPA -> backend
    Set-EnvVar (Join-Path $web '.env') 'VITE_API_MODE' 'live'
    Set-EnvVar (Join-Path $web '.env') 'VITE_API_BASE' 'http://localhost:8090'
    # Dev bypass: login lokal tanpa Ecopa (dev-only, mati di production).
    Set-EnvVar (Join-Path $backend '.env') 'ASETTO_DEV_LOGIN' 'true'
    Set-EnvVar (Join-Path $backend '.env') 'ASETTO_SPA_URL' 'http://localhost:5180'
    Write-Host '    SPA: mode LIVE -> http://localhost:8090 (dev-login Ecopa bypass AKTIF)' -ForegroundColor Yellow
}
else {
    Write-Host '    SPA: mode MOCK (default). Pakai -Live agar memanggil backend.' -ForegroundColor Yellow
}

# --- Jalankan kedua server ---------------------------------------------------
Write-Host '==> Menjalankan server...' -ForegroundColor Cyan

# Backend: pakai `php -S` + router bawaan Laravel, BUKAN `php artisan serve`.
# `php artisan serve` gagal bind di PHP 8.5.x Windows ("Failed to listen ...
# (reason: ?)") padahal built-in server PHP sendiri jalan normal.
$backendPublic = Join-Path $backend 'public'
$laravelRouter = Join-Path $backend 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location `"$backend`"; `$env:LARAVEL_PUBLIC_PATH='$backendPublic'; php -S 127.0.0.1:8090 -t `"$backendPublic`" `"$laravelRouter`""
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location `"$web`"; npm run dev"
# Scheduler: retries the Akunta journal queue + runs scheduled depreciation.
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location `"$backend`"; php artisan schedule:work"

Write-Host ''
Write-Host 'Asetto berjalan:' -ForegroundColor Green
Write-Host '  Backend   : http://localhost:8090'
Write-Host '  Web SPA   : http://localhost:5180'
Write-Host '  Scheduler : flush-outbox (tiap 5 menit) + depresiasi terjadwal'
Write-Host ''
Write-Host 'Tutup ketiga jendela PowerShell yang terbuka untuk menghentikan semuanya.'
