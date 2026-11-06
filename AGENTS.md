# AGENTS.md — Asetto

Panduan kerja untuk agent/AI dan contributor di repository **Asetto**. Dokumen
ini adalah handover dari sesi diskusi arsitektur (2026-11-03/04) dan dibuat agar
sesi lanjutan bisa langsung eksekusi tanpa mengulang diskusi.

> Status repo saat file ini dibuat: **kosong** (baru `git init`). Belum ada
> aplikasi. Tugas sesi lanjutan adalah men-scaffold Asetto sesuai panduan ini.

---

## 1. Apa itu Asetto

Asetto adalah **aplikasi manajemen aset perusahaan** untuk UKM Indonesia. Ia
adalah **child app (tier ketiga)** di ekosistem Akunta: aplikasi domain yang
berdiri sendiri, memakai Ecopa untuk identitas/SSO, dan mengirim jurnal ke
Akunta sebagai proses akhir akuntansi.

### Fitur dasar (ditetapkan user)

- CRUD aset perusahaan
- Depresiasi aset dengan penentuan metode depresiasi
- Monitor kondisi aset
- Pelimpahan tanggung jawab penggunaan aset (ke entitas kantor atau personil)
- Penghapusan / penjualan aset
- Fitur lain terkait

Peristiwa ekonomis dari fitur di atas (mis. beban depresiasi, pelepasan aset,
laba/rugi penjualan aset) di-posting sebagai **jurnal ke Akunta**, bukan dicatat
sebagai ledger sendiri. Asetto adalah sub-ledger aset; Akunta adalah general
ledger-nya.

---

## 2. Posisi Asetto di ekosistem: dua sumbu yang TERPISAH

Jangan campur dua hal ini. Ini inti arsitekturnya.

| Sumbu | Pusat | Arah | Mekanisme |
|---|---|---|---|
| **Identitas / login** | **Ecopa** (hub / IdP) | Asetto ↔ Ecopa langsung | OIDC (`ecopa-client`) |
| **Data akuntansi** | **Akunta** (ujung/GL) | Asetto → Akunta | REST API (`api-client`), token server-to-server |

- Asetto login **langsung ke Ecopa**, bukan lewat Akunta.
- Asetto kirim jurnal **ke Akunta** lewat API.
- "Akunta adalah ujung" itu soal **data**, bukan **identitas**.

Komponen ekosistem (semua ada di repo Akunta `C:\laragon\www\akunta`):

```
ecopa/            ← Main Tier: Identity Provider / SSO (Laravel 12 + Filament 4)
apps/accounting/  ← Akunta backend (general ledger)
apps/payroll/     ← child app (CONTOH pola untuk Asetto)
apps/cash-mgmt/   ← child app (CONTOH pola untuk Asetto)
modules/ecopa-client/  ← package SSO client yang dipakai semua child app
modules/api-client/    ← package kontrak API ke Akunta
```

---

## 3. Keputusan yang SUDAH final

1. **Repo terpisah.** Asetto TIDAK di dalam monorepo Akunta. Repo ini berdiri
   sendiri. (Keputusan user 2026-11-03.)
2. **SSO lewat Ecopa, BUKAN IdP sendiri.** Asetto tidak membangun sistem SSO
   sendiri. Tidak ada login username/password di Asetto sama sekali. Login =
   redirect OIDC ke Ecopa.
3. **Jangan reinvent.** Ikuti pola child app yang sudah terbukti di
   `apps/payroll` dan `apps/cash-mgmt` pada repo Akunta.

## 4. Keputusan yang MASIH terbuka (putuskan di awal scaffold)

**Cara menarik `ecopa-client` dan `api-client` ke repo terpisah.** Di monorepo
keduanya adalah package path lokal; di repo terpisah harus ditarik via Composer.
Pilihan:

1. **Composer VCS repository** — tarik langsung dari repo git. Paling ringan,
   tanpa publish. **Rekomendasi: mulai dari sini.**
2. **Private Packagist / registry** — lebih rapi untuk banyak app, perlu setup.
3. **Extract modul jadi package repo sendiri** — paling bersih jangka panjang,
   kerja ekstra di awal.

Konfirmasikan pilihan ini ke user sebelum menulis `composer.json`.

---

## 5. Kontrak autentikasi SSO (ikuti persis)

Sumber kebenaran lengkap ada di repo Akunta:
`C:\laragon\www\akunta\docs\CHILD_APP_REGISTRATION_GUIDE.md`. **Baca itu sebelum
menyentuh auth.** Ringkasan:

### Alur login (silent SSO)

1. User buka Asetto → belum ada sesi lokal → redirect ke
   `{ECOPA_URL}/oauth/authenticate`.
2. Bila user sudah punya sesi Ecopa aktif (mis. baru dari Akunta), Ecopa
   langsung terbitkan `code` **tanpa menampilkan layar login**.
3. Callback Asetto verifikasi `id_token` terhadap JWKS Ecopa
   (`/oauth/jwks.json`), cek issuer & exp.
4. Asetto upsert **shadow user** lokal dari claims → `Auth::login()`.
5. User masuk. Tidak pernah ada password di Asetto.

### Registrasi app ke Ecopa (first-access wizard)

- Wizard publik hanya minta **Ecopa URL** + **Registration Token**.
- Asetto `POST {ECOPA_URL}/api/app-registration-requests` dengan
  `{ name, slug, base_url }`. Usulan `slug`: `asset` atau `asetto` (final-kan
  dengan admin Ecopa; konsisten dengan `self_slug` di config).
- Ecopa approve → kirim webhook `app.registration.approved` (bertanda tangan
  dengan Registration Token) berisi `client_id`, `client_secret`,
  `webhook_secret`, `api_token`. Asetto simpan **terenkripsi**. Tidak ada input
  credential manual.

### Lifecycle user (webhook, idempotent)

Satu endpoint `POST {APP_URL}/webhooks/ecopa`, verifikasi signature
`X-Ecopa-Signature: sha256=hmac_sha256(raw_body, webhook_secret)`:

| Event | Tindakan Asetto |
|---|---|
| `user.assigned` | Buat/aktifkan shadow user + assignment keanggotaan (app-wide). Role default di-set otomatis: **admin → role `admin`, selain itu → `operator`** (`config/asetto_permissions.php:default_role`). Pilihan role manual admin yang sudah ada dipertahankan (hanya di-set saat `role_id` masih null). |
| `user.updated` | Perbarui nama/email shadow user |
| `user.revoked` | Cabut assignment + sesi/token, pertahankan histori |
| `user.deleted` | Nonaktifkan user + akses, pertahankan record historis |

### Role & akses entitas

- Ecopa hanya kirim `app_role` = `admin` atau `user`. User yang **available** di
  Asetto adalah yang sudah di-assign ke app di Ecopa (lewat webhook di atas) —
  tidak ada jalur provisioning via email.
- **Role default** saat assignment: `operator` (untuk non-admin) atau `admin`.
  Role rinci lain (Asset Manager, User, dst.) dipilih admin lewat UI. Daftar role
  ada di `config/asetto_permissions.php`.
- **Akses entitas TIDAK otomatis.** Assignment keanggotaan app-wide
  (`entity_id = null`) tidak memberi akses ke entitas mana pun. Admin menetapkan
  akses per-entitas di **Pengaturan → Entitas** (klik entitas → tambah user
  dengan role di bawah admin); ini membuat assignment ber-`entity_id`.
  - Non-admin: `getTenants()/accessibleEntityIds()` hanya dari assignment
    ber-`entity_id`. `EntityController@index` & `AssetController@index`
    di-scope ke entitas tsb; `show`/mutasi aset dijaga `authorizeEntity()`.
  - Admin (SSO `app_role=admin` atau role lokal `admin`): akses semua entitas.
- **Gerbang keamanan sebenarnya ada di Asetto** (session guard + assignment
  tersinkron webhook + scoping entitas di atas), bukan di menu Ekosistem Akunta.
  Backend wajib otorisasi tiap mutasi; menyembunyikan menu/tombol bukan security
  boundary.

### Menu Ekosistem

Asetto otomatis muncul di menu Ekosistem Akunta (dan app lain) begitu user
ter-assign ke Asetto di Ecopa. Menu dibangun Akunta dari
`{ECOPA_URL}/api/user/{id}/apps` dan klik hanya `window.open(url)` — login
otomatis terjadi via silent SSO. Ini **URL-based dan lintas-repo**, tidak
terpengaruh pemisahan repo. Asetto cukup menyediakan URL yang bisa menerima
redirect OIDC.

---

## 6. Reuse package (jangan tulis ulang)

- **`ecopa-client`** (`C:\laragon\www\akunta\modules\ecopa-client`) — seluruh
  OIDC client, verifikasi JWKS, exchange code, userinfo, server-to-server API
  ke Ecopa, serta base `EcopaAuthController` abstrak. Subclass-kan
  `provisionUser($claims)` untuk upsert shadow user Asetto.
- **`api-client`** (`C:\laragon\www\akunta\modules\api-client`) — kontrak API ke
  Akunta untuk posting jurnal. Gunakan ini, JANGAN impor model/service internal
  Akunta. Pakai idempotency key untuk tiap posting.

Pola implementasi konkret: baca `apps/payroll` dan `apps/cash-mgmt` di repo
Akunta — keduanya child app yang melakukan persis ini (SSO + posting jurnal).

---

## 7. Rencana scaffold (untuk sesi lanjutan)

Urutan yang disarankan. Konfirmasi keputusan §4 dulu.

1. Scaffold backend Laravel (versi selaras ekosistem; cek versi di
   `apps/payroll`). Tambahkan tooling: Pint, Pest, PSR-4.
2. Pasang `ecopa-client` + `api-client` via Composer (cara sesuai §4).
3. Route & controller SSO: `ecopa.login` / `ecopa.callback` / `ecopa.logout`,
   subclass `EcopaAuthController`, config `ecopa.php` (`self_slug`,
   `registration_name=Asetto`).
4. First-access registration wizard + endpoint `/webhooks/ecopa` (approval +
   lifecycle user, idempotent, signature verify).
5. Shadow user + model assignment + RBAC lokal (role rinci aset).
6. Domain: migrasi & model aset, metode depresiasi, kondisi, custodian
   (entitas/personil), pelepasan/penjualan.
7. Integrasi posting jurnal ke Akunta via `api-client` (depresiasi, disposal).
8. Frontend (bila perlu SPA terpisah — ikuti pola `accounting-web`/`poso-web`).
9. Test: SSO flow, webhook idempotency (pakai `Http::fake()`), otorisasi
   per-role, posting jurnal.

Catatan: kaitkan tiap fitur dengan Permission Management lokal Asetto sejak
awal (petakan aksi → permission), seperti disiplin di repo Akunta.

---

## 8. Aturan kerja

1. Periksa `git status` sebelum mengedit; pertahankan perubahan yang tidak
   terkait.
2. Jangan bangun IdP/SSO sendiri dan jangan tambahkan login username/password.
   Identitas selalu lewat Ecopa.
3. Jangan impor model/service internal Akunta; komunikasi ke Akunta hanya lewat
   `api-client`. Pertahankan idempotensi dan tenant/entity context.
4. Jurnal yang dikirim ke Akunta harus balance dan mengikuti invariant domain
   Akunta (periode terbuka, status posting, mode buku). Baca kontrak Akunta
   sebelum menentukan skema posting.
5. Jangan commit secret. Credential SSO/webhook disimpan terenkripsi, didapat
   dari approval callback — bukan ditulis manual ke `.env`/repo.
6. Jangan edit artefak generate / vendor (`vendor/`, `node_modules/`, build).
7. Ikuti gaya kode sekitar; PHP pakai Pint, pola Pest.
8. Perubahan perilaku publik disertai test.
9. Tinjau dampak tiap fitur ke Permission Management lokal — bagian dari selesai,
   bukan pekerjaan tambahan.

---

## 9. Referensi di repo Akunta

Semua path berikut relatif ke `C:\laragon\www\akunta`:

- `docs/CHILD_APP_REGISTRATION_GUIDE.md` — kontrak registrasi & webhook (WAJIB).
- `modules/ecopa-client/` — package SSO client.
- `modules/api-client/` — package API ke Akunta.
- `apps/payroll/`, `apps/cash-mgmt/` — child app contoh.
- `AGENTS.md` — aturan ekosistem (referensi, sebagian spesifik Akunta).
- `docs/architecture.md`, `docs/spec.md`, `docs/decisions.md` — konteks domain.

---

## 10. Menjalankan / mencoba aplikasi (server lokal)

Ada skrip **`serve.ps1`** di root repo yang menyiapkan dependency + database
lalu menjalankan **backend Laravel** (http://localhost:8090 — port 8090 dipakai
agar tidak bentrok dengan Akunta) dan **web SPA** (http://localhost:5180)
sekaligus di dua jendela PowerShell.

**Perintah untuk agent/AI:** bila user memerintahkan **"run"**, **"jalankan"**,
**"jalankan server"**, **"coba aplikasi"**, atau yang semakna dengan menjalankan
aplikasi/server, jalankan skrip ini (jangan menjalankan `php artisan serve` /
`npm run dev` satu per satu secara manual):

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Opsi: `-Live` (SPA memanggil backend sungguhan, bukan mock) · `-Fresh`
(migrate:fresh --seed, reset database). Contoh: `.\serve.ps1 -Live`.

**Dev login (bypass Ecopa) — LOKAL saja.** Untuk development/review tanpa Ecopa,
ada sakelar on/off: `ASETTO_DEV_LOGIN=true` di `backend/.env` (default `false`,
mustahil aktif di production). Saat aktif, route login mem-bypass Ecopa dan
login sebagai dev admin (tanpa password). `serve.ps1 -Live` otomatis
menyalakannya. Untuk SSO sungguhan nanti: set `ASETTO_DEV_LOGIN=false` + isi
kredensial `ECOPA_*` — tidak ada perubahan kode (lihat §8.2; ini shim dev,
bukan IdP/login password baru).

Catatan: ini khusus menjalankan/mencoba aplikasi. Perintah lain seperti
"jalankan test" tetap memakai `vendor/bin/pest`, bukan skrip ini.

---

## 11. Konvensi UI/UX (preferensi standar user — berlaku tiap development)

Ini preferensi tetap dari user (Dede). **Terapkan sebagai default di setiap
fitur baru dan perubahan UI, tanpa perlu diminta ulang.** Jika sebuah permintaan
bertentangan dengan salah satunya, ikuti permintaan itu lalu konfirmasi.

1. **Bahasa:** seluruh teks UI dalam Bahasa Indonesia.
2. **Input angka:** SEMUA field angka (nominal rupiah, kuantitas, bulan, dll.)
   memakai komponen `NumberInput` (`web/src/components/ui/primitives.tsx`) →
   mask ribuan titik gaya Indonesia (mis. `240.000.000`); nilai yang disimpan
   tetap digit mentah. Jangan pakai `<Input type="number">` polos.
3. **Daftar/tabel yang bisa banyak baris:** wajib ada pagination di sisi
   **client DAN backend**, jangan render semua baris sekaligus. Pola:
   `GET /...?page=&per_page=&<filter>&sort=&dir=` → envelope
   `{ items, page, per_page, total, last_page }`; di-mirror di mock
   (`web/src/api/mock/db.ts`); hook `useAssetsPaged`-style; search di-debounce;
   halaman balik ke 1 saat filter berubah. Default 25/halaman + info
   "Menampilkan X–Y dari Z".
4. **Filter:** tampil sebagai **overlay popover** (mengambang di atas konten,
   tutup via klik-luar/Esc), bukan panel inline yang mendorong tabel. Filter
   yang pilihannya hanya dua → **radio**, bukan dropdown.
5. **Aksi sekunder:** kelompokkan tombol (Tambah/Ubah/Hapus/Ekspor/Impor/
   Pelepasan/dll.) ke dalam menu titik-tiga (⋮) `KebabMenu`, hindari deretan
   banyak tombol di header.
6. **Operasi aset** (ubah kondisi, pelimpahan, pelepasan/penjualan) dilakukan
   dari **halaman detail aset** (menu ⋮ atau tab), bukan menu sidebar terpisah.
7. **Ekspor/Impor:** berkas hasil ekspor sekaligus berfungsi sebagai template
   impor (kolom identik).
8. **Hindari duplikasi informasi** antar komponen; ringkas tampilan (mis. data
   yang sudah ada di header/strip tidak diulang di kartu detail). Gabungkan
   kartu terkait dengan pemisah garis bila perlu, bukan kartu terpisah-pisah.
9. **Nav active-state:** cocokkan pada **batas segmen path** (`=== href` atau
   diawali `href + '/'`) agar `/aset` tidak ikut aktif di `/aset-saya`.
10. **Mock ↔ backend sinkron:** tiap perubahan kontrak API diterapkan di backend
    Laravel DAN di mock SPA (`handlers.ts`/`db.ts`) sekaligus, dengan test.
