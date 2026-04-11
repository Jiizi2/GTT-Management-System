# Dokumentasi Backend

Dokumen ini menjelaskan arsitektur backend, mode data, endpoint API, dan operasional database.

## 1. Ringkasan Teknis

- Lokasi: `apps/backend`
- Framework: NestJS 11 (TypeScript)
- Konfigurasi: `@nestjs/config` + `joi`
- ORM: Prisma
- Database: PostgreSQL (untuk mode `prisma`)
- Security middleware: `helmet`
- Logging: `nestjs-pino` + `pino`
- API docs: `@nestjs/swagger`
- Global rate limiting: `@nestjs/throttler`
- Prefix API global: `/api`

## 2. Modul Backend

Modul utama di `src/app.module.ts`:

- `AuthModule`
- `GroupsModule`
- `InvoicesModule`
- `MasterDataModule`
- `HealthModule`
- `PrismaModule`

## 3. Autentikasi dan Otorisasi

Implementasi:

- Guard global (`AuthGuard`) dipasang lewat `APP_GUARD`.
- Browser session sekarang memakai cookie `HttpOnly` + `SameSite=Lax`.
- Guard tetap menerima header `Authorization: Bearer <token>` untuk kompatibilitas internal/test.
- Token ditandatangani dan diverifikasi di `AuthService` memakai `@nestjs/jwt` dengan JWT HS256.
- Request write yang terautentikasi via cookie harus datang dari origin tepercaya (proteksi CSRF berbasis origin).
- Login rate limiter memakai memory untuk `DATA_SOURCE=memory`, dan bucket persisten di PostgreSQL untuk `DATA_SOURCE=prisma` agar tidak reset saat restart backend.

Lifecycle token auth custom:

- Format token: `base64url(header).base64url(payload).base64url(signature)` dengan header `{ alg: "HS256", typ: "JWT" }`.
- Payload saat ini berisi: `id`, `name`, `username`, `email`, `accessTier`, `exp`, `rememberSession`.
- Expiry default: 12 jam.
- Expiry untuk `rememberSession=true`: 14 hari.
- Invalidation saat `POST /api/auth/logout`: backend hanya menghapus cookie browser; tidak ada server-side revocation list untuk token yang sudah terbit.
- Implikasi operasional: jika token bocor dan belum expired, token tetap valid sampai `exp` tercapai atau `AUTH_SECRET` diganti.
- Rotasi secret: mengganti `AUTH_SECRET` lalu restart backend akan menginvalidasi semua session/token aktif, karena saat ini hanya ada satu secret aktif dan belum ada mekanisme multi-key / `kid`.
- JWT sekarang sudah memakai library standar, tetapi invalidation/revocation tetap masih sederhana dan berbasis expiry + rotasi secret.

Route public:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`

Route protected:

- selain route public di atas.

Pembatasan role:

- endpoint user management dan write master data memerlukan `super-admin`.

## 4. Konfigurasi Runtime

Validasi dilakukan di `runtime-config.ts`.

Variabel penting:

- `PORT` (default `3001`)
- `DATA_SOURCE` (`memory` | `prisma`)
- `DATABASE_URL` (wajib jika `DATA_SOURCE=prisma`)
- `NODE_ENV`
- `AUTH_SECRET` (wajib dan minimal 32 karakter di production)
- `CORS_ORIGINS`
- `TRUST_PROXY` (opsional; default `false`, aktifkan hanya jika backend berada di balik reverse proxy tepercaya)
- `LOG_LEVEL` (opsional; default `debug` di non-production, `info` di production)
- `AUTH_COOKIE_DOMAIN` (opsional; default host-only cookie)
- login rate limit env (`AUTH_LOGIN_RATE_LIMIT_*`)
- global throttle env (`THROTTLE_DEFAULT_*`)

Aturan khusus:

- `NODE_ENV=production` mewajibkan `DATA_SOURCE=prisma`.
- `AUTH_BOOTSTRAP_DEFAULT_USERS=true` ditolak di production.
- `AUTH_BOOTSTRAP_DEFAULT_USERS` default-nya `false` dan harus diaktifkan eksplisit.
- Saat `DATA_SOURCE=prisma` dan `AUTH_BOOTSTRAP_DEFAULT_USERS=true`, env `DEV_AUTH_SUPERADMIN_PASSWORD` dan `DEV_AUTH_ADMIN_PASSWORD` wajib diisi.
- `CORS_ORIGINS` wajib diisi origin eksplisit di production; wildcard `*` tidak didukung untuk mode cookie auth.
- `TRUST_PROXY=true` hanya boleh dipakai jika header proxy benar-benar disanitasi oleh reverse proxy tepercaya.

## 5. Mode Data

### `memory`

- Default saat `DATA_SOURCE` tidak di-set.
- Tidak memerlukan database.
- Data disimpan in-memory (non-persisten).
- Berguna untuk dev cepat dan e2e lokal.

### `prisma`

- Menggunakan PostgreSQL melalui Prisma.
- Data persisten.
- Mendukung migration, seeding, dan operasi produksi.
- Khusus master data: bila model/tabel `MasterDataOption` belum sinkron, backend hanya boleh fallback ke default in-memory pada `development`/`test`. Di `production`, backend akan fail-fast agar deployment drift tidak tersembunyi.

## 6. Endpoint API

## OpenAPI / Swagger

- UI dokumentasi tersedia di `GET /api/docs`
- Dokumen JSON tersedia di `GET /api/docs/json`
- Dokumentasi dihasilkan langsung dari controller dan DTO backend, sehingga perubahan route / payload akan ikut tercermin di OpenAPI document

## Health

- `GET /api/health` (public)
  - route ini melewati global throttling agar aman untuk health probe

## Auth

- `POST /api/auth/login` (public)
- `POST /api/auth/logout` (public)
- `GET /api/auth/session`
- `GET /api/auth/users`
- `POST /api/auth/users`
  - bisa menerima password awal opsional agar akun langsung aktif
- `PATCH /api/auth/users/:userId`
- `PUT /api/auth/users/:userId/password`
  - set/reset password managed user
- `DELETE /api/auth/users/:userId`

## Groups

- `GET /api/groups`
  - query opsional: `q`, `page`, `pageSize`, `filter`, `projection`
  - `q` memakai `searchDocument` ter-normalisasi untuk code, name, status, dan package name
  - di PostgreSQL, pencarian dibantu index trigram pada `Group.searchDocument`
- `GET /api/groups/audit-logs`
  - query opsional: `groupCode`, `limit`
- `GET /api/groups/:idOrCode`
- `POST /api/groups`
- `PUT /api/groups/:idOrCode`
- `PATCH /api/groups/:idOrCode`
- `DELETE /api/groups/:idOrCode`
- `POST /api/groups/:idOrCode/itinerary`
- `PATCH /api/groups/:idOrCode/itinerary/:itemId`
- `DELETE /api/groups/:idOrCode/itinerary/:itemId`
- `POST /api/groups/:idOrCode/checklist/confirm-driver`
- `POST /api/groups/:idOrCode/checklist/reset-driver`
- `POST /api/groups/:idOrCode/visa/hotels`
- `PATCH /api/groups/:idOrCode/visa/hotels/:hotelId`
- `DELETE /api/groups/:idOrCode/visa/hotels/:hotelId`
- `PUT /api/groups/:idOrCode/visa/raudhah`

## Invoices

- `GET /api/invoices`
- `GET /api/invoices/clients`
- `POST /api/invoices`
- `PATCH /api/invoices/:id`
- `DELETE /api/invoices/:id` -> selalu `405` (disarankan ubah status ke `CANCELLED`)

## Master Data

- `GET /api/master-data/categories`
- `GET /api/master-data/options`
- `POST /api/master-data/options` (super-admin)
- `PATCH /api/master-data/options/:optionId` (super-admin)
- Catatan runtime:
  - `development` / `test`: read boleh fallback ke default in-memory jika Prisma client atau tabel `MasterDataOption` belum siap.
  - `production`: tidak ada fallback read; backend mengembalikan error server yang meminta sinkronisasi `db:generate` / `db:migrate`.

## 7. Database dan Domain Model

Skema Prisma utama:

- Auth: `AuthUser`
- Security/runtime: `AuthLoginRateLimitBucket`
- Master data: `MasterDataOption`
- Operasional grup:
  - `Group`, `GroupAuditLog`, `Musyrif`, `NextActivity`, `GroupTimelineItem`, `ItineraryItem`, `GroupNote`
    - `Group.searchDocument` menyimpan string pencarian ter-normalisasi untuk query `q`
  - `VisaSetup`, `VisaHotelAgreement`, `RaudhahAppointment`
  - `ChecklistAssignment`, `ChecklistDriver`
- Invoice:
  - `InvoiceClient`, `Invoice`

Enum penting:

- `GroupTone`, `VisaStatus`, `VisaPaymentStatus`
- `AgreementApprovalStatus`, `AgreementCity`, `GroupRaudhahStatus`
- `ChecklistAssignmentStatus`, `InvoiceStatus`, `AuthUserRole`

## 8. Migrasi dan Seeding

Command dari root:

- `npm run db:generate:backend`
- `npm run db:migrate:backend`
- `npm run db:seed:backend`
- `npm run db:studio:backend`

Reset seed (destruktif terhadap data target):

- PowerShell:
  - `$env:SEED_RESET="true"; npm run db:seed:backend`

Catatan:

- `npm run db:seed:backend` menolak berjalan saat `NODE_ENV=production`.
- Seed auth user Prisma membutuhkan `DEV_AUTH_SUPERADMIN_PASSWORD` dan `DEV_AUTH_ADMIN_PASSWORD`.

## 9. Testing Backend

Command dari root:

- `npm run test --workspace backend` -> unit test backend.
- `npm run test:integration --workspace backend` -> integration Prisma.
- `npm run test:api --workspace backend` -> API e2e backend.
- `npm run test:vitest --workspace backend` -> runner baru berbasis `vitest + supertest` untuk HTTP/integration test yang lebih nyaman dikembangkan bertahap.

## 10. Logging dan Tracing

- Request log sekarang memakai `nestjs-pino` dengan output terstruktur.
- Setiap request menerima header `x-request-id` dan id yang sama ikut muncul di log, sehingga tracing antar request/error lebih mudah.
- Header sensitif seperti `Authorization`, `Cookie`, dan `Set-Cookie` sudah di-redact dari log request/response.
- Di development/test, log dirender lebih nyaman dibaca lewat `pino-pretty`; di production tetap output JSON terstruktur.
