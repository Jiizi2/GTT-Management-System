# Peta Kodebase

Panduan navigasi cepat monorepo GTT untuk developer baru maupun AI assistant. Fokus pada struktur folder, titik masuk, dan alur data utama.

## Struktur Root

```
c:\vibe coding\
├── apps/
│   ├── frontend/      ← React SPA (port 4173 dev)
│   └── backend/       ← NestJS REST API (port 3001 dev)
├── docs/              ← Dokumentasi teknis
├── deploy/            ← Script dan Dockerfile untuk VPS
├── package.json       ← Root workspace + script shortcut
├── docker-compose.yml ← Dev DB PostgreSQL
└── docker-compose.prod.yml
```

## Quick Start

```bash
# Mode paling ringan (tanpa database)
npm install
npm run dev:backend   # http://localhost:3001/api
npm run dev:frontend  # http://localhost:4173

# Mode dengan PostgreSQL
docker compose up -d
# isi apps/backend/.env
npm run db:generate:backend
npm run db:migrate:backend
npm run db:seed:backend
npm run dev:backend
```

---

## Frontend (`apps/frontend/src/`)

### Titik Masuk

| File | Peran |
|---|---|
| `index.tsx` | Mount React app ke DOM |
| `app.tsx` | Auth gate: login screen atau dashboard shell |
| `components/dashboard-workspace-shell.tsx` | Shell utama dashboard (sidebar + main content + mobile nav) |
| `components/app-main-content.tsx` | Router halaman dalam dashboard, lazy loading |

### Struktur Direktori

```
src/
├── app.tsx
├── index.tsx
├── styles.css              ← Global CSS + design tokens
├── components/             ← Komponen UI reusable
├── pages/                  ← Halaman per modul
├── hooks/                  ← Custom hooks + business logic
│   └── app-controller/     ← Sub-controller dashboard
├── shared/                 ← Domain types, API client, routes, query keys
└── theme/                  ← Dark/light mode provider
```

### Halaman dan Route

| Route | File | Akses |
|---|---|---|
| `/login` | `pages/login-page.tsx` | Public |
| `/overview` | `pages/overview-page.tsx` | Semua |
| `/groups/:code` | `pages/group-detail-page.tsx` | Semua |
| `/itinerary-builder/:code` | `pages/group-itinerary-builder-page.tsx` | Semua |
| `/new-group` | `pages/new-group-screen.tsx` | Semua |
| `/checklist` | `pages/checklist-page.tsx` | Semua |
| `/visa` | `pages/visa-tracking-page.tsx` | Semua |
| `/visa/:code` | `pages/visa-detail-page.tsx` | Semua |
| `/agreement-inbox` | `pages/agreement-inbox-page.tsx` | Semua |
| `/invoice` | `pages/invoice-list-page.tsx` | Semua |
| `/raudhah-reminder` | `pages/raudhah-reminder-page.tsx` | Semua |
| `/user-management` | `pages/manage-role-page.tsx` | super-admin |
| `/master-data` | `pages/master-data-page.tsx` | super-admin |
| `/profile` | `pages/profile-page.tsx` | Semua |

### File Shared Penting

| File | Isi |
|---|---|
| `shared/app-domain.ts` | Semua TypeScript types domain (GroupData, VisaTrackingRow, dll.) |
| `shared/visa-domain.ts` | Logic visa: format tanggal, generate WhatsApp copy text |
| `shared/app-route.ts` | Route builder functions |
| `shared/api-client.ts` | `fetchBackend()` + `fetchBackendParsed()` |
| `shared/query-keys.ts` | Semua TanStack Query keys |
| `shared/auth-session.ts` | Session storage (non-sensitif) |

### Hooks Penting

| Hook | Fungsi |
|---|---|
| `hooks/use-app-controller.ts` | Controller utama dashboard — menyatukan semua state |
| `hooks/use-app-controller-backend.ts` | Semua interaksi API + mapping frontend↔backend |
| `hooks/app-controller/use-dashboard-group-records.ts` | State sinkronisasi group records |
| `hooks/use-auth-session-query.ts` | Query/mutation auth (login, logout, session) |
| `hooks/use-groups-query.ts` | TanStack Query untuk daftar grup |
| `hooks/use-invoice-backend.ts` | Fetch dan mutasi invoice |
| `hooks/use-master-data-backend.ts` | Fetch dan mutasi master data |

### Auth Flow Frontend

1. `useAuthSessionQuery()` dipanggil di `app.tsx`.
2. Snapshot sesi non-sensitif dicoba restore dari storage lokal.
3. Sesi diverifikasi ulang ke backend via `/api/auth/session`.
4. Jika valid → masuk dashboard. Jika tidak → redirect `/login`.

Catatan penting:
- Token **tidak** disimpan di JavaScript storage.
- Request ke backend memakai `credentials: "include"` (cookie-based).

---

## Backend (`apps/backend/src/`)

### Titik Masuk

| File | Peran |
|---|---|
| `main.ts` | Bootstrap NestJS: CORS, helmet, validation pipe, swagger, prefix `/api` |
| `app.module.ts` | Root module: rakit semua modul + global config logging throttling |

### Modul Backend

| Modul | Lokasi | Fungsi |
|---|---|---|
| `AuthModule` | `src/auth/` | Login/logout/session, user management, JWT cookie |
| `GroupsModule` | `src/groups/` | CRUD grup, itinerary, visa, checklist, audit log |
| `InvoicesModule` | `src/invoices/` | CRUD invoice dan invoice client |
| `MasterDataModule` | `src/master-data/` | Lookup options lintas modul |
| `PrismaModule` | `src/prisma/` | Prisma service shared |
| `HealthModule` | `src/health/` | `GET /api/health` untuk health probe |
| `RuntimeMaintenanceModule` | `src/runtime-maintenance/` | Mode maintenance |

### Arsitektur Modul Groups

Modul `groups` memakai layered architecture:

```
src/groups/
├── http/           ← Controllers (HTTP layer)
├── application/    ← Business logic (service layer)
├── domain/         ← Pure domain functions
├── infrastructure/ ← Memory store + Prisma builders
└── dto/            ← Data Transfer Objects
```

### Endpoint Utama

```
# Auth
POST   /api/auth/login         (public)
POST   /api/auth/logout        (public)
GET    /api/auth/session
GET    /api/auth/users         (super-admin)
POST   /api/auth/users         (super-admin)
PATCH  /api/auth/users/:id     (super-admin)
PUT    /api/auth/users/:id/password (super-admin)
DELETE /api/auth/users/:id     (super-admin)

# Groups
GET    /api/groups             ?q=&page=&pageSize=&filter=&projection=
GET    /api/groups/:idOrCode
GET    /api/groups/audit-logs  ?groupCode=&limit=
POST   /api/groups
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

# Hotel Agreement Drafts
GET    /api/hotel-agreement-drafts
POST   /api/hotel-agreement-drafts
PATCH  /api/hotel-agreement-drafts/:id
POST   /api/hotel-agreement-drafts/:id/assign
DELETE /api/hotel-agreement-drafts/:id

# Invoices
GET    /api/invoices
GET    /api/invoices/clients
POST   /api/invoices
PATCH  /api/invoices/:id

# Master Data
GET    /api/master-data/categories
GET    /api/master-data/options    ?categoryKey=&includeInactive=
POST   /api/master-data/options    (super-admin)
PATCH  /api/master-data/options/:id (super-admin)
```

### Database Schema

File: `apps/backend/prisma/schema.prisma`

Model utama: `AuthUser`, `Group`, `ItineraryItem`, `ChecklistAssignment`, `ChecklistDriver`, `VisaSetup`, `VisaHotelAgreement`, `RaudhahAppointment`, `HotelAgreementDraft`, `InvoiceClient`, `Invoice`, `MasterDataOption`.

`Group` adalah entitas pusat — memiliki relasi ke hampir semua model operasional.

### Keamanan

- Semua endpoint dilindungi `AuthGuard` global, kecuali yang `@Public()`.
- Session via HttpOnly cookie (`SameSite=Lax`, `Secure` di production).
- Bearer token didukung untuk kompatibilitas internal/test.
- Login rate limiter aktif (persisten di PostgreSQL mode prisma).
- Global throttling via `@nestjs/throttler`.
- Proteksi CSRF berbasis origin untuk write request via cookie.

### OpenAPI / Swagger

- UI: `GET /api/docs`
- JSON: `GET /api/docs/json`

---

## Alur Data End-to-End (Contoh: Load Daftar Grup)

```
OverviewScreen
  ↓ useAppController
    ↓ use-dashboard-group-records.ts
      ↓ use-groups-query.ts (TanStack Query)
        ↓ fetchBackend("GET /api/groups")
          ↓ GroupsController.findAll()
            ↓ GroupsService.findAll()
              ↓ memory store ATAU Prisma (tergantung DATA_SOURCE)
```

---

## Titik Masuk Terbaik Untuk Membaca Kode

Urutan baca yang efektif untuk developer baru:

1. `README.md`
2. `docs/application-overview.md`
3. `apps/frontend/src/app.tsx`
4. `apps/frontend/src/components/app-main-content.tsx`
5. `apps/backend/src/main.ts`
6. `apps/backend/src/app.module.ts`
7. `apps/backend/prisma/schema.prisma`
8. `apps/backend/src/groups/application/groups.service.ts`
