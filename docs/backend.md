# Dokumentasi Backend

Dokumen ini menjelaskan arsitektur backend, mode data, endpoint API, dan operasional database.

## 1. Ringkasan Teknis

- Lokasi: `apps/backend`
- Framework: NestJS 11 (TypeScript)
- ORM: Prisma
- Database: PostgreSQL (untuk mode `prisma`)
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
- Token diverifikasi di `AuthService` (HMAC signed token).
- Request write yang terautentikasi via cookie harus datang dari origin tepercaya (proteksi CSRF berbasis origin).

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
- `AUTH_COOKIE_DOMAIN` (opsional; default host-only cookie)
- login rate limit env (`AUTH_LOGIN_RATE_LIMIT_*`)

Aturan khusus:

- `NODE_ENV=production` mewajibkan `DATA_SOURCE=prisma`.
- `AUTH_BOOTSTRAP_DEFAULT_USERS=true` ditolak di production.
- `CORS_ORIGINS` harus diisi origin eksplisit; wildcard `*` tidak didukung untuk mode cookie auth.

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

## 6. Endpoint API

## Health

- `GET /api/health` (public)

## Auth

- `POST /api/auth/login` (public)
- `POST /api/auth/logout` (public)
- `GET /api/auth/session`
- `GET /api/auth/users`
- `POST /api/auth/users`
- `PATCH /api/auth/users/:userId`
- `DELETE /api/auth/users/:userId`

## Groups

- `GET /api/groups`
  - query opsional: `q`, `page`, `pageSize`, `filter`
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

## 7. Database dan Domain Model

Skema Prisma utama:

- Auth: `AuthUser`
- Master data: `MasterDataOption`
- Operasional grup:
  - `Group`, `Musyrif`, `NextActivity`, `GroupTimelineItem`, `ItineraryItem`, `GroupNote`
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

## 9. Testing Backend

Command dari root:

- `npm run test --workspace backend` -> unit test backend.
- `npm run test:integration --workspace backend` -> integration Prisma.
- `npm run test:api --workspace backend` -> API e2e backend.
