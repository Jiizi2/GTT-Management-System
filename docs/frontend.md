# Dokumentasi Frontend

Dokumen ini menjelaskan arsitektur frontend yang aktif saat ini, alur data per modul, aturan aman saat menambah fitur, dan checklist deploy/auth untuk production.

## 1. Ringkasan Teknis

- Lokasi: `apps/frontend`
- Stack: React 19 + TypeScript + Tailwind CSS + React Router + TanStack Query + React Hook Form + Zod
- Bundler/build: `esbuild`
- Dev server: `scripts/dev.mjs`
- Testing: Vitest untuk unit/smoke test, Playwright untuk e2e
- API transport: browser cookie auth + `credentials: "include"`

## 2. Peta Arsitektur

Alur besar frontend:

`index.tsx`
-> `app.tsx`
-> auth gate
-> `dashboard-workspace-shell.tsx`
-> `app-main-content.tsx`
-> lazy-loaded page
-> page/local hooks
-> shared API client
-> backend `/api/*`

Direktori penting:

- `src/app.tsx`
  - Gerbang utama auth.
  - Memutuskan login route vs dashboard shell.
  - Login dan dashboard shell sama-sama lazy loaded.
- `src/components/*`
  - Komponen UI reusable dan shell layout.
  - `app-main-content.tsx` adalah pusat route dashboard.
- `src/pages/*`
  - Halaman utama per modul.
  - Beberapa route berat sudah dipecah lagi jadi chunk terpisah, misalnya invoice workspace, add-group itinerary workspace, export helper, dan modal detail.
- `src/hooks/*`
  - Query/mutation, orchestration app controller, dan integrasi backend.
- `src/shared/*`
  - Infrastruktur lintas fitur: query keys, auth session persistence, API client, error formatting, resolver base URL backend, dan helper domain.
- `src/theme/*`
  - Theme mode + provider.
- `public/*`
  - Asset statis dan `index.html`.
- `scripts/*`
  - Dev server, runtime config injection, clean build, bundle analysis, dan generator subset Material Symbols.

Catatan boundary saat ini:

- Boundary fitur sudah mulai dirapikan di level loading behavior dan helper shared, tetapi struktur folder fisik utama masih berbasis `pages/`, `hooks/`, dan `shared/`.
- Saat menambah modul baru, prioritaskan boundary logis yang jelas walau folder fisiknya belum sepenuhnya dipindah ke `features/`.

## 3. Feature Map

| Modul                  | UI Entry                                                             | State / Query utama                                               | Backend utama                                              | Catatan                                                                              |
| ---------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Auth                   | `src/app.tsx`, `src/pages/login-page.tsx`                            | `use-auth-session-query.ts`                                       | `/api/auth/login`, `/api/auth/session`, `/api/auth/logout` | Login screen sengaja ringan dan tidak lagi memakai RHF/Zod untuk menekan bundle awal |
| Dashboard shell        | `src/components/dashboard-workspace-shell.tsx`                       | `use-app-controller.ts`                                           | bergantung modul aktif                                     | Shell desktop/mobile dan sync feedback                                               |
| Overview + Groups      | `src/pages/overview-page.tsx`, `src/pages/group-detail-page.tsx`     | `use-app-controller.ts`, `use-dashboard-group-records.ts`         | `/api/groups*`                                             | Sumber data utama dashboard                                                          |
| Add New Group          | `src/pages/new-group-screen.tsx`                                     | local form state + callback ke app controller                     | save lewat handler group                                   | Identity shell dan itinerary workspace dipisah chunk-nya                             |
| Itinerary workspace    | `src/pages/add-group-workspace-page.tsx`                             | RHF + local derived state                                         | save lewat payload group                                   | Hanya di-load saat dibutuhkan oleh New Group                                         |
| Checklist              | `src/pages/checklist-page.tsx`                                       | data grup + local storage checklist                               | update grup / visa via group hooks                         | Turunan dari itinerary dan group data                                                |
| Visa Tracking / Detail | `src/pages/visa-tracking-page.tsx`, `src/pages/visa-detail-page.tsx` | data grup + derived visa rows                                     | update grup/visa via group hooks                           | Export dan modal detail sudah lazy                                                   |
| Invoice list           | `src/pages/invoice-list-page.tsx`                                    | `useInvoiceDashboardQuery()`                                      | `/api/invoices`, `/api/invoices/clients`, `/api/health`    | List ringan, workspace create/edit deferred                                          |
| Invoice workspace      | `src/pages/invoice-page.tsx`                                         | RHF + `useCreateInvoiceMutation()` + `useUpdateInvoiceMutation()` | `/api/invoices*`                                           | Hanya aktif penuh saat backend `DATA_SOURCE=prisma`                                  |
| User Management        | `src/pages/manage-role-page.tsx`                                     | `use-user-management-query.ts`                                    | `/api/auth/users*`                                         | Hanya untuk `super-admin`                                                            |
| Master Data            | `src/pages/master-data-page.tsx`                                     | `use-master-data-query.ts`                                        | `/api/master-data/*`                                       | Menyuplai option lintas modul                                                        |
| Profile                | `src/pages/profile-page.tsx`                                         | local state + auth mutation                                       | auth endpoints                                             | Lebih ringan dan mostly UI-local                                                     |

## 4. Route Map dan Lazy Boundaries

Dashboard routes dipusatkan di `src/components/app-main-content.tsx`.

Route utama:

- `/login`
- `/overview`
- `/groups/:groupCode`
- `/new-group`
- `/checklist`
- `/visa`
- `/visa/:groupCode`
- `/invoice`
- `/raudhah-reminder`
- `/user-management`
- `/master-data`
- `/profile`

Lazy boundary yang sekarang penting:

- login screen
- dashboard shell
- setiap page route utama
- add-group itinerary workspace
- invoice workspace create/edit
- export helper PDF
- modal detail group/visa

Aturan praktis:

- List page, dashboard page, dan shell route harus tetap ringan.
- Workspace berat, modal besar, dan generator PDF sebaiknya di-load saat aksi user membutuhkannya.
- Ikon Material Symbols disajikan dari subset font lokal; setelah menambah ikon baru, jalankan `npm run assets:icons --workspace frontend` agar subset tetap sinkron.

## 5. Data Flow per Modul

### 5.1 Auth

Alur auth frontend:

1. `app.tsx` memanggil `useAuthSessionQuery()`.
2. Query awal memakai `readPersistedAuthSession()` sebagai `initialData`.
3. Frontend lalu memverifikasi sesi ke `/api/auth/session`.
4. Bila sesi valid:
   - snapshot sesi non-sensitif disimpan ke `localStorage` atau `sessionStorage`
   - UI masuk ke dashboard shell
5. Bila backend membalas `401`:
   - `fetchBackend()` otomatis memanggil `clearAuthSession()`
   - snapshot lokal dihapus
   - UI kembali ke login

Storage policy:

- `rememberSession=true` -> `localStorage`
- `rememberSession=false` -> `sessionStorage`
- token auth tidak disimpan di JS storage
- browser memakai cookie `HttpOnly` dari backend

File inti:

- `src/hooks/use-auth-session-query.ts`
- `src/hooks/use-auth-backend.ts`
- `src/shared/auth-session.ts`
- `src/shared/api-client.ts`

### 5.2 Dashboard Groups, Overview, Checklist, Visa

Alur data groups:

1. `dashboard-workspace-shell.tsx` membuat `AppController`.
2. `use-app-controller.ts` menggabungkan:
   - route state
   - group records state
   - sync feedback
3. `use-dashboard-group-records.ts` menjadi pusat read/write group records.
4. Hook backend/query yang dipakai:
   - `use-groups-query.ts`
   - `use-app-controller-backend.ts`
5. Page overview, group detail, checklist, visa tracking, dan raudhah reminder membaca data dari controller yang sama.

Implikasi penting:

- Perubahan group, visa, hotel, raudhah, dan checklist saling terkait.
- Jika menambah field group baru, audit semua consumer turunan:
  - overview stats
  - group detail
  - visa rows
  - checklist
  - reminder

### 5.3 Invoice

Alur data invoice:

1. Route `/invoice` masuk ke `invoice-list-page.tsx`.
2. List memanggil `useInvoiceDashboardQuery()`.
3. Query dashboard melakukan `Promise.all` ke:
   - data source health
   - invoice clients
   - invoice rows
4. Saat user memilih create/edit:
   - `invoice-page.tsx` di-load secara lazy
   - workspace form baru di-mount
5. Mutation create/update memperbarui cache `invoiceQueryKeys.dashboard`.

File inti:

- `src/pages/invoice-list-page.tsx`
- `src/pages/invoice-page.tsx`
- `src/pages/invoice-page-shared.ts`
- `src/hooks/use-invoice-query.ts`
- `src/hooks/use-invoice-backend.ts`

### 5.4 User Management dan Master Data

Alur admin/config:

- User Management memakai backend auth user endpoints.
- Master Data menjadi sumber opsi dinamis lintas modul, misalnya:
  - invoice status
  - issuing office
  - bank disbursement
  - saudi city
  - role options

Aturan penting:

- Jika suatu dropdown bisa berubah oleh admin, utamakan baca dari master data.
- Sediakan fallback lokal yang masuk akal bila query option kosong.

## 6. Shared Infra yang Wajib Dipakai

Saat menambah kode baru, utamakan memakai helper yang sudah ada:

- `src/shared/api-client.ts`
  - gunakan `fetchBackend()`, `parseBackendResponse()`, atau `fetchBackendParsed()`
  - jangan panggil `fetch()` mentah untuk request backend biasa
- `src/shared/api-error.ts`
  - gunakan extractor error yang seragam
- `src/shared/query-keys.ts`
  - tambahkan query key baru di sini dulu sebelum membuat hook query baru
- `src/shared/backend-api-base.ts`
  - semua endpoint backend relatif harus lewat resolver ini
- `src/shared/auth-session.ts`
  - jangan membuat penyimpanan sesi alternatif di file lain

## 7. Cara Extend dengan Aman

### 7.1 Menambah route baru

Checklist aman:

1. Tambahkan page di `src/pages/*`.
2. Daftarkan lazy import di `src/components/app-main-content.tsx` atau `src/app.tsx`.
3. Jika route perlu nav item, sinkronkan dengan `src/shared/app-route.ts` dan logic navigasi terkait.
4. Pastikan direct refresh route tidak bergantung pada state sementara browser.

Jangan:

- menaruh logic route baru langsung di shell besar tanpa lazy boundary
- mengimpor workspace berat ke page list ringan secara statis

### 7.2 Menambah integrasi API baru

Urutan yang direkomendasikan:

1. Tambah helper request di hook backend yang relevan.
2. Gunakan `fetchBackend()` dan parser/error helper shared.
3. Tambahkan query key baru di `query-keys.ts`.
4. Bungkus read flow dengan React Query.
5. Simpan optimistic update atau cache patch di mutation hook, bukan di page UI.

Jangan:

- menduplikasi `fetch + credentials + parse + 401 handling`
- membuat query key string langsung di page

### 7.3 Menambah form baru

Aturan aman:

- gunakan `import * as z from "zod/v4"` untuk menghindari bundle bloat dari entry lama
- jika form kecil dan ada di jalur login/critical path, pertimbangkan validasi manual yang ringan
- jika form besar, pecah schema/helper/preview/export ke file terpisah
- list page tidak boleh menanggung editor form berat bila editor hanya dipakai sesekali

### 7.4 Menambah PDF/export/helper berat

Aturan aman:

- helper export harus di-load dengan `import()` saat tombol diklik
- modal besar sebaiknya lazy-loaded
- generator preview/PDF jangan diimport statis dari page list

### 7.5 Mengubah domain model grup

Sebelum merge, audit modul berikut:

- overview
- group detail
- checklist
- visa tracking
- visa detail
- raudhah reminder
- invoice link/group code consumer

Perubahan field group hampir selalu punya efek turunan lintas page.

### 7.6 Mengubah auth flow

Jangan ubah tanpa audit penuh pada:

- `app.tsx`
- `use-auth-session-query.ts`
- `use-auth-backend.ts`
- `auth-session.ts`
- `api-client.ts`

Invariant yang harus tetap benar:

- frontend tidak menyimpan token auth mentah
- semua request backend memakai `credentials: "include"`
- response `401` membersihkan snapshot sesi lokal
- login, refresh page, dan logout tetap sinkron

## 8. Checklist Deploy dan Frontend Auth

### 8.1 Build-time checklist

- Tentukan apakah frontend memakai:
  - same-origin `/api`, atau
  - same-site subdomain seperti `app.example.com` -> `api.example.com`
- Isi `GTT_API_BASE_URL` hanya jika backend tidak memakai same-origin `/api`.
- Pastikan `dist/runtime-config.js` ikut ter-deploy bersama `index.html`.
- Jika memakai server static, file `runtime-config.js` harus dimuat sebelum `index.js`.

Catatan penting:

- Cookie auth backend memakai `SameSite=Lax`.
- Praktiknya, setup yang aman adalah same-origin atau subdomain dalam site yang sama.
- Frontend di domain yang benar-benar berbeda dari backend biasanya tidak cocok untuk flow cookie ini.

### 8.2 Backend checklist

- `CORS_ORIGINS` harus berisi origin frontend secara eksplisit.
- Jangan gunakan wildcard `*`.
- Production harus memakai HTTPS.
- Jika masih bring-up sementara lewat HTTP, backend harus memakai `AUTH_COOKIE_SECURE=false` atau login tidak akan persisten.
- Jika frontend dan backend memakai subdomain dalam satu domain induk, pertimbangkan `AUTH_COOKIE_DOMAIN=.example.com`.
- `AUTH_COOKIE_DOMAIN` harus berupa bare domain, bukan URL penuh.
- Gunakan `TRUST_PROXY=true` hanya jika reverse proxy memang trusted dan header-nya bersih.

### 8.3 Reverse proxy / static hosting checklist

- Semua route SPA harus fallback ke `index.html`.
- Jika memakai same-origin deployment, `/api` harus diproxy ke backend.
- Proxy tidak boleh membuang:
  - `Set-Cookie`
  - `Origin`
  - `Host`
  - `X-Forwarded-*` bila backend memang di belakang proxy trusted

### 8.4 Verifikasi auth setelah deploy

Uji minimal:

1. Login berhasil dan browser menerima cookie auth.
2. Refresh keras di `/overview` tetap mempertahankan sesi.
3. Refresh keras di route dalam seperti `/invoice` atau `/groups/:groupCode` tidak menghasilkan `404`.
4. `GET /api/auth/session` mengembalikan snapshot sesi valid setelah reload.
5. Logout menghapus sesi aktif dan UI kembali ke `/login`.
6. Saat cookie invalid/expired, frontend membersihkan snapshot lokal dan tidak stuck di dashboard.
7. Request write yang bergantung cookie tetap lolos origin validation backend.

## 9. Command Frontend

Dari root project:

- `npm run dev:frontend` -> jalankan dev server frontend
- `npm run build:frontend` -> build frontend
- `npm run lint:frontend` -> jalankan ESLint untuk frontend
- `npm run format:frontend` -> apply formatting frontend dengan Prettier
- `npm run format:check:frontend` -> cek formatting frontend dengan Prettier
- `npm run check --workspace frontend` -> type-check frontend
- `npm run test --workspace frontend` -> unit test frontend
- `npm run test:unit:watch --workspace frontend` -> watch mode unit test
- `npm run test:unit:coverage --workspace frontend` -> unit coverage frontend via Vitest V8
- `npm run test:unit:coverage:check --workspace frontend` -> unit coverage + threshold check
- `npm run test:smoke --workspace frontend` -> smoke test frontend
- `npm run test:smoke:coverage --workspace frontend` -> smoke coverage frontend
- `npm run test:smoke:watch --workspace frontend` -> watch mode smoke test
- `npm run test:e2e --workspace frontend` -> Playwright e2e frontend
- `npm run build:analyze --workspace frontend` -> build frontend + audit bundle

## 10. Aturan Cepat Sebelum Merge

Sebelum mengirim perubahan frontend yang cukup besar, minimal jalankan:

- `npm run check --workspace frontend`
- `npm run lint --workspace frontend`
- `npm run test --workspace frontend`

Tambahan saat menyentuh loading boundary atau bundle:

- `npm run build:analyze --workspace frontend`

Tambahan saat menyentuh auth/runtime/deploy:

- uji login
- uji hard refresh di route dashboard
- uji logout
