# Asetto Web (SPA)

Frontend SPA untuk **Asetto** — aplikasi manajemen aset, child app di ekosistem
Akunta. UI ini mengikuti **konsep** web Akunta (shell Metronic, grup sidebar,
label Indonesia, TanStack Query), dengan satu pembeda sengaja: **React** (bukan
SvelteKit seperti `accounting-web`/`poso-web`) dan **aksen teal** sebagai
penanda visual aplikasi aset.

## Stack

- **React 18 + TypeScript**, **Vite** (SPA)
- **TanStack Query** untuk server state
- **Tailwind CSS** dengan token tema (CSS variables, light/dark)
- **React Router** untuk routing SPA

## Menjalankan

```bash
cd web
npm install
npm run dev      # http://localhost:5180
npm run build    # output ke dist/ (SPA statis)
```

## Mode API

Diatur lewat `.env` (lihat `.env.example`):

| `VITE_API_MODE` | Perilaku |
|---|---|
| `mock` (default) | Jalan penuh di browser dengan dataset contoh. Tidak perlu backend. Alur depresiasi → jurnal ke Akunta disimulasikan di outbox lokal. |
| `live` | Memanggil backend Laravel Asetto di `VITE_API_BASE` (satu eTLD+1) lewat cookie + Sanctum CSRF, persis pola web Akunta. |

Kontrak REST yang di-mock ada di `src/api/mock/handlers.ts` — itulah permukaan
endpoint yang harus dipenuhi backend Asetto saat mode `live` diaktifkan.

## Arsitektur penting (jangan dilanggar)

- **Identitas lewat Ecopa (SSO/OIDC), bukan di SPA.** Di mode `live` SPA hanya
  redirect ke `{backend}/auth/ecopa/redirect`; dance OIDC terjadi di backend.
  Tidak ada login username/password di sini.
- **Posting jurnal ke Akunta itu server-to-server** (package PHP `api-client`),
  **bukan dari browser**. Jadi alur sebenarnya adalah:

  ```
  React SPA  →  backend Asetto  →  api-client  →  Akunta (general ledger)
  ```

  Mode `mock` memodelkan ini: run depresiasi membentuk jurnal balance
  (Dr Beban Depresiasi / Cr Akumulasi Depresiasi per kategori) dengan
  idempotency key `dep:<periode>`, lalu "mengirim"-nya ke outbox.

## Struktur

```
src/
  api/
    client.ts          # api.get/post/patch/del — switch mock vs live
    queries.ts         # query keys + hooks TanStack Query
    types.ts           # tipe domain
    mock/db.ts         # store in-memory + mesin depresiasi + posting jurnal
    mock/handlers.ts   # router REST mock (= kontrak backend)
  components/
    shell/             # AppShell, Sidebar, Topbar, nav
    ui/                # primitives, Table, Modal, toast, badges
  pages/               # satu file per layar (Dashboard, Aset, Depresiasi, …)
  hooks/useColorMode.ts
  lib/                 # format (IDR/tanggal), cn, queryClient
```

## Catatan untuk menyambung ke backend

1. Scaffold backend Laravel Asetto (lihat `../AGENTS.md` §7).
2. Implement endpoint sesuai `src/api/mock/handlers.ts`.
3. Set `VITE_API_MODE=live` + `VITE_API_BASE`, aktifkan Sanctum SPA auth, dan
   route `/auth/ecopa/*` di backend.
