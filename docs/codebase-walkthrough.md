# Peta Kodebase

Dokumen ini dibuat dari pembacaan struktur kode yang aktif saat ini. Fokusnya bukan manual penggunaan aplikasi, tetapi panduan cepat untuk memahami bagaimana monorepo ini disusun, file mana yang jadi titik masuk, dan alur data utama dari frontend sampai backend.

## 1. Gambaran Besar

Monorepo ini berisi dashboard operasional travel/umrah dengan dua aplikasi utama:

- `apps/frontend`: aplikasi web untuk tim operasional.
- `apps/backend`: REST API untuk auth, grup, invoice, dan master data.

Alur runtime utamanya:

1. User membuka frontend.
2. Frontend memverifikasi sesi ke backend lewat cookie auth.
3. Dashboard memuat data grup, invoice, master data, dan modul lain via `/api/*`.
4. Backend menyimpan data ke memory atau PostgreSQL, tergantung `DATA_SOURCE`.

## 2. Struktur Root

Folder dan file penting di root:

- `package.json`
  - root npm workspace untuk `apps/*`
  - menyatukan script build, test, QA, dan database
- `docker-compose.yml`
  - PostgreSQL lokal untuk development
- `docker-compose.prod.yml`
  - stack production sederhana: `web` + `backend` + `postgres`
- `docs/`
  - dokumentasi operasional, backend, frontend, deployment, dan QA
- `deploy/web/`
  - Dockerfile frontend web dan konfigurasi nginx

Script root yang paling penting:

- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run verify`
- `npm run qa`
- `npm run db:migrate:backend`
- `npm run db:seed:backend`

## 3. Cara Menjalankan Secara Lokal

Mode paling ringan:

1. `npm install`
2. `npm run dev:backend`
3. `npm run dev:frontend`

Pada mode ini backend default memakai `DATA_SOURCE=memory`, jadi tidak butuh database.

Kalau ingin mode persisten:

1. `docker compose up -d`
2. isi `apps/backend/.env`
3. jalankan:
   - `npm run db:generate:backend`
   - `npm run db:migrate:backend`
   - `npm run db:seed:backend`

## 4. Peta Frontend

Lokasi frontend ada di `apps/frontend`.

Titik masuk utama:

- `src/index.tsx`
  - mount React app
- `src/app.tsx`
  - auth gate utama
  - memutuskan apakah user masuk ke login screen atau dashboard shell
- `src/components/dashboard-workspace-shell.tsx`
  - shell utama dashboard desktop/mobile
- `src/components/app-main-content.tsx`
  - route dashboard dan lazy loading halaman

Direktori penting:

- `src/pages/`
  - halaman per modul seperti overview, group detail, checklist, visa, invoice, profile
- `src/hooks/`
  - orchestration state, query/mutation, dan adapter backend
- `src/shared/`
  - helper lintas modul seperti route builder, API client, query keys, session restore, domain mapper
- `src/components/`
  - layout shell dan komponen UI reusable
- `src/theme/`
  - theme provider dan mode tema

## 5. Alur Frontend

### Auth flow

File kunci:

- `apps/frontend/src/app.tsx`
- `apps/frontend/src/hooks/use-auth-session-query.ts`
- `apps/frontend/src/shared/auth-session.ts`

Alurnya:

1. App memanggil `useAuthSessionQuery()`.
2. Frontend mencoba restore snapshot sesi non-sensitif.
3. Backend diverifikasi lagi lewat `/api/auth/session`.
4. Jika valid, user masuk ke dashboard.
5. Jika tidak valid, user diarahkan ke `/login`.

Catatan penting:

- token tidak disimpan di JavaScript storage
- request backend memakai `credentials: "include"`
- backend mengandalkan cookie `HttpOnly`

### Dashboard flow

File kunci:

- `apps/frontend/src/components/dashboard-workspace-shell.tsx`
- `apps/frontend/src/hooks/use-app-controller.ts`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`

Shell dashboard memakai satu controller utama untuk:

- state navigasi
- daftar grup
- detail grup/visa yang sedang dipilih
- feedback sinkronisasi UI ke backend

Artinya, modul overview, checklist, visa, raudhah reminder, dan sebagian alur detail grup masih berbagi sumber data grup yang sama.

### Route frontend aktif

Route utama dibangun di `apps/frontend/src/components/app-main-content.tsx`:

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

Sebagian besar route di-load secara lazy agar bundle awal tetap ringan.

## 6. Modul Frontend yang Paling Penting

- `Overview`
  - daftar grup, ringkasan, filter, dan entry ke detail group
- `New Group`
  - input grup baru dan itinerary awal
- `Checklist`
  - kebutuhan driver dan assignment keberangkatan
- `Visa Tracking`
  - status visa, hotel agreement, dan Raudhah
- `Invoice`
  - daftar invoice, create/edit invoice, relasi ke grup/client
- `User Management`
  - CRUD user backend, hanya untuk `super-admin`
- `Master Data`
  - kelola opsi dinamis lintas modul

## 7. Peta Backend

Lokasi backend ada di `apps/backend`.

Titik masuk utama:

- `src/main.ts`
  - bootstrap NestJS
  - set CORS, helmet, validation pipe, exception filter, swagger, dan prefix `/api`
- `src/app.module.ts`
  - root module yang merakit semua modul backend

Modul yang terdaftar saat ini:

- `AuthModule`
- `PrismaModule`
- `RuntimeMaintenanceModule`
- `HealthModule`
- `GroupsModule`
- `InvoicesModule`
- `MasterDataModule`

Cross-cutting concern yang aktif global:

- `@nestjs/config` untuk env validation
- `nestjs-pino` untuk structured logging
- `@nestjs/throttler` untuk rate limiting global
- `helmet` untuk security headers
- `ApiExceptionFilter` untuk format error konsisten

## 8. Alur Backend

### Auth

File kunci:

- `apps/backend/src/auth/auth.controller.ts`
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/auth/auth.guard.ts`

Peran utamanya:

- login/logout/session
- manajemen user
- role guard untuk endpoint khusus
- browser session lewat cookie `HttpOnly`

### Groups

File kunci:

- `apps/backend/src/groups/http/groups.controller.ts`
- `apps/backend/src/groups/application/groups.service.ts`
- `apps/backend/src/groups/application/groups-command.service.ts`
- `apps/backend/src/groups/application/groups-query.service.ts`

Modul `groups` adalah inti domain aplikasi. Ia menangani:

- CRUD grup
- itinerary
- checklist driver
- visa hotel agreement
- appointment Raudhah
- audit log perubahan grup

Strukturnya sudah mulai domain-first:

- `http/`
- `application/`
- `domain/`
- `infrastructure/`

### Invoices

File kunci:

- `apps/backend/src/invoices/invoices.controller.ts`
- `apps/backend/src/invoices/invoices.service.ts`

Modul ini mengelola:

- daftar invoice
- daftar client invoice
- create/update invoice

### Master Data

File kunci:

- `apps/backend/src/master-data/master-data.controller.ts`
- `apps/backend/src/master-data/master-data.service.ts`

Master data dipakai untuk opsi dinamis lintas modul frontend seperti dropdown dan pilihan kategori tertentu.

## 9. Model Data Inti

Skema database didefinisikan di `apps/backend/prisma/schema.prisma`.

Entitas utama:

- `AuthUser`
- `Group`
- `GroupAuditLog`
- `ItineraryItem`
- `ChecklistAssignment`
- `ChecklistDriver`
- `VisaSetup`
- `VisaHotelAgreement`
- `RaudhahAppointment`
- `InvoiceClient`
- `Invoice`
- `MasterDataOption`
- `AuthLoginRateLimitBucket`
- `AppThrottleBucket`

Hubungan domain yang paling penting:

- satu `Group` menjadi pusat banyak data operasional
- `Group` punya itinerary, visa setup, checklist assignment, audit log, invoice, dan invoice client
- `VisaSetup` punya hotel agreement dan appointment Raudhah
- `ChecklistAssignment` bisa terkait ke `ItineraryItem`

## 10. Mode Penyimpanan Data

Backend punya dua mode:

- `DATA_SOURCE=memory`
  - cepat untuk development
  - non-persisten
- `DATA_SOURCE=prisma`
  - persisten ke PostgreSQL
  - dipakai untuk staging/production

Kesan dari implementasinya:

- banyak service memang dirancang bisa berjalan di dua mode
- `groups.service.ts` misalnya punya jalur memory dan Prisma sekaligus
- production dipaksa ke mode `prisma`

## 11. Docker Compose

### `docker-compose.yml`

Dipakai untuk development database lokal.

Service:

- `postgres`
  - image `postgres:16-alpine`
  - port host default `6543`
  - volume `gtt_postgres_data`

### `docker-compose.prod.yml`

Dipakai untuk deployment stack sederhana.

Service:

- `web`
  - build dari `deploy/web/Dockerfile`
  - expose port web default `8080`
- `backend`
  - build dari `apps/backend/Dockerfile`
  - jalan di mode `prisma`
  - membaca env dari `apps/backend/.env`
- `postgres`
  - hanya expose internal network Compose

Interpretasi arsitekturnya:

- frontend production disajikan lewat nginx container
- nginx berbicara ke backend di jaringan internal Compose
- PostgreSQL sengaja tidak dibuka ke host pada mode production Compose

## 12. Titik Masuk Terbaik Saat Mau Membaca Kode

Kalau baru pertama kali masuk ke repo ini, urutan baca yang paling efektif:

1. `README.md`
2. `docs/application-overview.md`
3. `apps/frontend/src/app.tsx`
4. `apps/frontend/src/components/app-main-content.tsx`
5. `apps/backend/src/main.ts`
6. `apps/backend/src/app.module.ts`
7. `apps/backend/prisma/schema.prisma`
8. `apps/backend/src/groups/application/groups.service.ts`

Urutan ini memberi gambaran dari UI, route, API bootstrap, lalu ke model data dan domain inti.

## 13. Kesimpulan Singkat

Kodebase ini adalah monorepo operasional yang cukup rapi dengan pembagian jelas antara frontend dashboard dan backend API. Pusat domain bisnisnya ada di modul `groups`, sedangkan auth, invoice, dan master data menjadi modul pendukung utama. Untuk development cepat, backend bisa jalan tanpa database; untuk deployment nyata, arsitekturnya diarahkan ke PostgreSQL + Docker Compose.
