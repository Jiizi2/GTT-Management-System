# Dokumentasi Frontend

Dokumen ini menjelaskan arsitektur frontend, alur state, integrasi API, dan command yang dipakai.

## 1. Ringkasan Teknis

- Lokasi: `apps/frontend`
- Stack: React 19 + TypeScript + Tailwind CSS + React Router + TanStack Query + React Hook Form + Zod
- Bundler/build: esbuild
- Dev server: script custom `scripts/dev.mjs`
- Testing: unit test, smoke test, dan Playwright e2e

## 2. Struktur Penting

Direktori utama:

- `src/app.tsx`: root app routes + auth gate + layout desktop/mobile.
- `src/features/groups/*`: boundary feature untuk groups, workspace itinerary, query groups, dan controller dashboard group records.
  - `domain.ts`: facade groups untuk consumer feature.
  - `options.ts`: option list, form seed, page size, dan helper bus count.
  - `itinerary.ts`: builder/editing/helper itinerary dan schedule.
  - `checklist.ts`: builder checklist H-1/H+2.
  - `status.ts`: tone/status grup dan normalisasi snapshot overview.
- `src/features/invoice/*`: boundary feature untuk invoice API, React Query bindings, export, dan halaman invoice.
- `src/features/visa/*`: boundary feature untuk domain/helper visa.
- `src/components/*`: komponen UI reusable.
- `src/pages/*`: layar/halaman per fitur.
- `src/hooks/*`: state orchestration dan komunikasi backend.
- `src/hooks/app-controller/*`: hook modular untuk navigation, feedback, dan group state.
- `src/shared/app-domain-types.ts`: source of truth untuk type domain lintas fitur.
- `src/shared/app-domain-core.ts`: helper inti netral yang dipakai lintas fitur.
- `src/shared/app-domain.ts`: compatibility facade untuk import lama yang belum dipindah.
- `src/shared/*`: helper bisnis frontend lain yang belum punya boundary fitur sendiri.
- `public/*`: aset statis + `index.html`.

Catatan transisi:

- Path lama di `src/pages/*`, `src/hooks/*`, `src/shared/visa-domain.ts`, dan `src/shared/app-domain.ts` masih disediakan sebagai compatibility wrapper/facade agar refactor boundary feature bisa dilakukan bertahap tanpa memutus import lama sekaligus.

## 3. Navigasi dan Halaman

Navigasi browser sekarang dikendalikan oleh `react-router-dom`, dengan `activeNav`
turunan dari path aktif. Halaman utama:

- Overview
- Add New Group
- H-1 Checklist
- Visa Tracking + Visa Detail
- Invoice
- Raudhah Reminder
- User Management
- Master Data
- Profile

Deklarasi route halaman dipusatkan di `src/components/app-main-content.tsx`
(lazy loaded per screen).

## 4. State Management dan Sinkronisasi

State global dashboard dipusatkan di hook:

- `src/hooks/use-app-controller.ts`

Hook ini sekarang mengomposisikan beberapa hook kecil:

- `src/hooks/app-controller/use-dashboard-route-state.ts`
- `src/hooks/app-controller/use-dashboard-sync-feedback.ts`
- `src/hooks/app-controller/use-dashboard-group-records.ts`

Tanggung jawab hook ini:

- Menyimpan state UI (nav, query, sidebar, selection).
- Memuat data grup dari backend.
- Menangani save/update/delete grup dan perubahan visa/checklist.
- Menampilkan feedback sinkronisasi sukses/gagal.
- Memakai access tier dari sesi aktif yang sudah direstorasi dari backend.

Strategi update:

- Optimistic update di UI.
- Lalu sync ke backend.
- Fetch session dan group list memakai TanStack Query.
- Jika backend gagal:
  - host lokal: tetap lanjut fallback lokal,
  - host non-lokal: state bisa direfresh dari backend.

## 5. Autentikasi di Frontend

File inti:

- `src/hooks/use-auth-backend.ts`
- `src/shared/auth-session.ts`

Mekanisme:

- Login kirim `identifier`, `password`, `rememberSession` ke `/api/auth/login`.
- Form login memakai `react-hook-form` + `zod`.
- Backend mengembalikan snapshot sesi lalu menyimpan auth token ke cookie `HttpOnly`.
- Frontend hanya menyimpan snapshot sesi non-sensitif:
  - `localStorage` bila `rememberSession=true`
  - `sessionStorage` bila `rememberSession=false`
- Semua request backend memakai `credentials: "include"`.
- Saat bootstrap app, frontend memanggil `/api/auth/session` untuk memverifikasi dan merestorasi sesi.
- Bila backend balas `401`, session dihapus otomatis.

## 6. Integrasi API per Domain

Hook backend utama:

- `src/features/groups/api.ts` -> endpoint grup (`/api/groups` dan turunannya).
- `src/features/invoice/api.ts` -> invoice (`/api/invoices`, `/api/invoices/clients`, `/api/health`).
- `use-user-management-backend.ts` -> user management (`/api/auth/users`).
- `use-master-data-backend.ts` -> master data (`/api/master-data/*`).
- `use-saudi-city-options.ts` -> konsumsi category `saudi-city` dari master data.

## 7. Runtime Config Frontend

Base URL API di-resolve berurutan:

1. `window.__GTT_API_BASE_URL__` (jika sudah ada sebelum bundle app jalan),
2. `http://localhost:3001/api` saat host `localhost/127.0.0.1`,
3. fallback `/api` (same-origin).

Ini memungkinkan deploy frontend dan backend:

- domain yang sama (reverse proxy), atau
- domain terpisah dengan injeksi runtime config.

Catatan keamanan deployment:

- Jika frontend dan backend beda origin, backend harus mengizinkan origin frontend secara eksplisit di `CORS_ORIGINS`.
- Jangan gunakan wildcard `*` karena auth browser sekarang berbasis cookie ber-credential.

Saat build atau `dev` dijalankan, frontend menulis `dist/runtime-config.js` dari
`GTT_API_BASE_URL` bila env itu diisi. File ini dimuat sebelum `index.js`, jadi
deploy VPS bisa tetap pakai satu artifact build yang sama dan tinggal mengubah
env saat proses build.

## 8. Browser Routes

Frontend sekarang memakai URL path sebagai navigasi browser. Endpoint yang bisa
langsung diketik di address bar:

- `/overview`
- `/checklist`
- `/visa`
- `/visa/:groupCode`
- `/groups/:groupCode`
- `/new-group`
- `/invoice`
- `/raudhah-reminder`
- `/user-management`
- `/master-data`
- `/profile`
- `/login`

Catatan deploy:

- Server frontend harus mengarah ke `index.html` untuk semua path di atas agar
  refresh dan direct access tidak menghasilkan `404`.
- Kalau frontend dan backend ada di domain berbeda, tetap pastikan `/api`
  diproxy ke backend atau `GTT_API_BASE_URL` diisi saat build.

## 8. Command Frontend

Dari root project:

- `npm run dev:frontend` -> jalankan dev server frontend.
- `npm run build:frontend` -> build frontend.
- `npm run check --workspace frontend` -> type-check frontend.
- `npm run test --workspace frontend` -> unit test frontend.
- `npm run test:smoke --workspace frontend` -> smoke test frontend.
- `npm run test:e2e --workspace frontend` -> Playwright e2e frontend.
