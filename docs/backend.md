# Dokumentasi Backend

## Stack

- NestJS 11 (TypeScript)
- Prisma ORM + PostgreSQL
- `@nestjs/config` + validasi env
- `nestjs-pino` (structured logging)
- `@nestjs/throttler` (rate limiting global)
- `helmet` (security headers)
- `@nestjs/swagger` (OpenAPI docs)
- Prefix API global: `/api`

---

## Struktur Direktori

```
apps/backend/src/
├── main.ts                      ← Bootstrap NestJS
├── app.module.ts                ← Root module
├── runtime-config.ts            ← Runtime config dari env
├── bootstrap-super-admin.ts     ← Init super admin default
├── auth/                        ← Autentikasi & otorisasi
├── groups/                      ← Domain utama: grup perjalanan
│   ├── http/                    ← Controllers
│   ├── application/             ← Business logic (services)
│   ├── domain/                  ← Pure domain functions
│   ├── infrastructure/          ← Memory store + Prisma builders
│   └── dto/                     ← Data Transfer Objects
├── invoices/                    ← Invoice management
├── master-data/                 ← Master data (lookup options)
├── prisma/                      ← Prisma service
├── config/                      ← Env validation
├── http/                        ← Shared HTTP DTOs
├── health/                      ← Health check
├── logging/                     ← Logging utilities
├── throttling/                  ← Rate limiting
└── runtime-maintenance/         ← Maintenance mode
```

---

## Modul Backend

| Modul | Lokasi | Fungsi |
|---|---|---|
| `AuthModule` | `src/auth/` | Login/logout/session, JWT cookie, user management |
| `GroupsModule` | `src/groups/` | CRUD grup, itinerary, visa, checklist, audit log |
| `InvoicesModule` | `src/invoices/` | CRUD invoice dan invoice client |
| `MasterDataModule` | `src/master-data/` | Lookup options lintas modul |
| `PrismaModule` | `src/prisma/` | Prisma service shared |
| `HealthModule` | `src/health/` | Health probe endpoint |
| `RuntimeMaintenanceModule` | `src/runtime-maintenance/` | Maintenance mode |

---

## Autentikasi dan Otorisasi

- `AuthGuard` dipasang secara global via `APP_GUARD`.
- Session browser memakai HttpOnly cookie (`SameSite=Lax`, `Secure` di production).
- Bearer token (`Authorization: Bearer <token>`) didukung untuk kompatibilitas internal/test.
- Token JWT HS256 ditandatangani dan diverifikasi di `AuthService`.
- Proteksi CSRF berbasis origin untuk write request via cookie.
- Login rate limiter: in-memory di mode `memory`, persisten di PostgreSQL di mode `prisma`.

### Lifecycle Token

- Expiry default: 12 jam.
- `rememberSession=true`: 14 hari.
- Logout hanya menghapus cookie browser — tidak ada server-side revocation list.
- Mengganti `AUTH_SECRET` + restart akan menginvalidasi semua session aktif.

### Route Public (tidak butuh auth)

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Pembatasan Role

- Endpoint write master data dan user management hanya untuk `super-admin`.
- Decorator `@Roles('super-admin')` dipakai di level method controller.

---

## Konfigurasi Environment

Semua variabel divalidasi di startup. Lihat `apps/backend/.env.example` untuk daftar lengkap.

Variabel wajib di production:

| Variabel | Keterangan |
|---|---|
| `PORT` | Port server (default `3001`) |
| `DATA_SOURCE` | `memory` atau `prisma` |
| `DATABASE_URL` | Wajib jika `DATA_SOURCE=prisma` |
| `NODE_ENV` | `development`, `test`, atau `production` |
| `AUTH_SECRET` | Wajib di production, minimal 32 karakter |
| `CORS_ORIGINS` | Origin frontend yang diizinkan, wajib eksplisit di production |

Variabel opsional penting:

| Variabel | Keterangan |
|---|---|
| `TRUST_PROXY` | `true` hanya jika backend di balik reverse proxy tepercaya |
| `LOG_LEVEL` | Default `warn` dev, `info` production |
| `AUTH_COOKIE_DOMAIN` | Default host-only |
| `AUTH_COOKIE_SECURE` | Default `true` production |

Aturan khusus:
- `NODE_ENV=production` mewajibkan `DATA_SOURCE=prisma`.
- `AUTH_BOOTSTRAP_DEFAULT_USERS=true` ditolak di production.

---

## Mode Data

### `memory`

- Default saat `DATA_SOURCE` tidak di-set.
- Non-persisten, tidak butuh database.
- Cocok untuk dev cepat dan e2e lokal.
- Throttling memakai in-memory storage.

### `prisma`

- Data persisten ke PostgreSQL.
- Mendukung migration, seeding, dan production.
- Throttling memakai bucket persisten `AppThrottleBucket`.
- Di `production`: tidak ada fallback in-memory — backend fail-fast jika schema drift.

---

## Endpoint API Lengkap

OpenAPI UI: `GET /api/docs`  
OpenAPI JSON: `GET /api/docs/json`

### Health

```
GET  /api/health  (public, skip throttling)
```

### Auth

```
POST   /api/auth/login              (public)
POST   /api/auth/logout             (public)
GET    /api/auth/session
GET    /api/auth/users              (super-admin)
POST   /api/auth/users              (super-admin)
PATCH  /api/auth/users/:userId      (super-admin)
PUT    /api/auth/users/:userId/password  (super-admin)
DELETE /api/auth/users/:userId      (super-admin)
```

### Groups

```
GET    /api/groups                           ?q=&page=&pageSize=&filter=&activeOnly=&projection=
GET    /api/groups/audit-logs                ?groupCode=&limit=
GET    /api/groups/:idOrCode
POST   /api/groups
POST   /api/groups/identity
PUT    /api/groups/:idOrCode
PATCH  /api/groups/:idOrCode
DELETE /api/groups/:idOrCode
POST   /api/groups/:id/itinerary
PATCH  /api/groups/:id/itinerary/:itemId
DELETE /api/groups/:id/itinerary/:itemId
POST   /api/groups/:id/checklist/confirm-driver
POST   /api/groups/:id/checklist/reset-driver
POST   /api/groups/:id/visa/hotels
PATCH  /api/groups/:id/visa/hotels/:hotelId
DELETE /api/groups/:id/visa/hotels/:hotelId
PUT    /api/groups/:id/visa/raudhah
```

### Hotel Agreement Drafts

```
GET    /api/hotel-agreement-drafts           ?q=&assignmentStatus=
POST   /api/hotel-agreement-drafts
PATCH  /api/hotel-agreement-drafts/:id
POST   /api/hotel-agreement-drafts/:id/assign
DELETE /api/hotel-agreement-drafts/:id
```

### Invoices

```
GET    /api/invoices
GET    /api/invoices/clients
POST   /api/invoices
PATCH  /api/invoices/:id
DELETE /api/invoices/:id   → selalu 405 (gunakan status CANCELLED)
```

### Master Data

```
GET    /api/master-data/categories
GET    /api/master-data/options     ?categoryKey=&includeInactive=
POST   /api/master-data/options     (super-admin)
PATCH  /api/master-data/options/:id (super-admin)
```

---

## Database Schema

File: `apps/backend/prisma/schema.prisma`

### Model Utama dan Relasi

| Model | Relasi |
|---|---|
| `AuthUser` | Standalone |
| `Group` | Pusat domain — parent dari hampir semua model |
| `Musyrif` | 1-1 ke Group |
| `NextActivity` | 1-1 ke Group |
| `GroupTimelineItem` | N-1 ke Group |
| `ItineraryItem` | N-1 ke Group |
| `GroupNote` | N-1 ke Group |
| `GroupAuditLog` | N-1 ke Group (optional) |
| `VisaSetup` | 1-1 ke Group |
| `VisaHotelAgreement` | N-1 ke VisaSetup |
| `RaudhahAppointment` | N-1 ke VisaSetup |
| `HotelAgreementDraft` | N-1 ke Group (optional) |
| `ChecklistAssignment` | N-1 ke Group; optional ke ItineraryItem |
| `ChecklistDriver` | N-1 ke ChecklistAssignment |
| `InvoiceClient` | N-1 ke Group (optional) |
| `Invoice` | N-1 ke InvoiceClient; N-1 ke Group (optional) |
| `MasterDataOption` | Standalone |

Group juga mendukung relasi self-referential: `Group.parentGroupId` → parent group (untuk sub-grup).

### Enum Penting

| Enum | Nilai |
|---|---|
| `GroupTone` | `ACTIVE`, `INACTIVE` |
| `VisaStatus` | `DRAFT`, `PENDING`, `ISSUED` |
| `VisaPaymentStatus` | `PAID`, `UNPAID`, `PARTIAL` |
| `AgreementApprovalStatus` | `WAITING`, `APPROVED`, `REJECTED` |
| `AgreementCity` | `MAKKAH`, `MADINAH` |
| `GroupRaudhahStatus` | `FREE`, `AFTER`, `BEFORE` |
| `ChecklistAssignmentStatus` | `NOT_COMPLETE`, `ASSIGNED` |
| `InvoiceStatus` | `PAID`, `PENDING`, `OVERDUE`, `CANCELLED` |
| `AuthUserRole` | `SUPER_ADMIN`, `ADMIN`, `FINANCE_MANAGER`, `CUSTOMER_SUPPORT` |

---

## Database Commands

```bash
npm run db:generate:backend   # generate Prisma client
npm run db:migrate:backend    # jalankan migrasi
npm run db:seed:backend       # seed data awal
npm run db:studio:backend     # buka Prisma Studio

# Reset seed (destruktif)
$env:SEED_RESET="true"; npm run db:seed:backend
```

Catatan:
- `db:seed` ditolak saat `NODE_ENV=production`.
- Seed membutuhkan env password dev (lihat `.env.example`).

---

## Logging

- Structured logging via `nestjs-pino`.
- Setiap request mendapat `x-request-id` yang ikut muncul di log.
- Header, cookie, dan body sensitif tidak masuk log.
- Development: `pino-pretty` (readable). Production: JSON terstruktur.
- Default level: `warn` di non-production, `info` di production.
- `GET /api/health` di-skip dari request logging.
- Business events terstruktur: `auth.*`, `group.*`, `visa.*`, `checklist.*`, `invoice.*`, `master-data.*`.

---

## Testing Backend

```bash
npm run test:unit --workspace backend         # unit test
npm run test:integration --workspace backend  # integration test (butuh DB)
npm run test:api --workspace backend          # API e2e test
```

---

## Arsitektur Modul Groups (Detail)

Modul groups adalah domain utama dan memakai layered architecture:

- **`http/`** — `GroupsController`, `HotelAgreementDraftsController`
- **`application/`** — `GroupsService` (facade), `GroupsCommandService`, `GroupsQueryService`, `HotelAgreementDraftsService`
- **`domain/`** — Pure functions: validasi hotel, search document builder, itinerary title generator
- **`infrastructure/`** — Memory store (mode `memory`) + Prisma builders (mode `prisma`)

Test aktif ada di `src/groups/tests/`.
