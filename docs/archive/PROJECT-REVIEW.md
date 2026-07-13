# 🔍 GTT Management System — Comprehensive Project Review

> Dashboard operasional Umrah untuk **Ghaniya Tour and Travel**.
> Review dilakukan pada codebase monorepo full-stack (React + NestJS + PostgreSQL).
> Tanggal Review: 6 Juli 2026

---

## 📊 Executive Summary

| Aspek | Rating | Catatan |
|---|:---:|---|
| **Arsitektur** | ⭐⭐⭐⭐ | Layered architecture solid, repository pattern diterapkan |
| **Keamanan** | ⭐⭐⭐⭐ | Multi-layer auth, CSRF protection, rate limiting |
| **Kualitas Kode** | ⭐⭐⭐ | Umumnya baik, namun ada beberapa "god file" yang perlu refactor |
| **Testing** | ⭐⭐⭐ | Coverage threshold ada, tapi frontend masih rendah |
| **DevOps** | ⭐⭐⭐⭐ | Docker + Compose production-ready, CI pipeline exists |
| **Dokumentasi** | ⭐⭐⭐⭐⭐ | Excellent — README, docs/, env examples semua lengkap |
| **Maintainability** | ⭐⭐⭐ | Beberapa file oversized menghambat maintainability |

**Verdict**: Project ini sangat **well-engineered** untuk skala tim kecil/internal tool. Arsitektur backend dan security model-nya sudah production-grade. Area perbaikan utama ada di **frontend code organization** dan **test coverage**.

---

## 1. Arsitektur & Desain Sistem

### ✅ Strengths

#### Monorepo Setup
- npm workspaces dengan pemisahan `apps/frontend` dan `apps/backend` — clean dan standard.
- Shared `tsconfig.base.json` memastikan consistency TypeScript compilation settings.
- Root-level scripts menyediakan shortcuts yang ergonomis (`npm run dev:frontend`, `npm run qa:full`, dll).

#### Backend: Layered Architecture
Backend mengikuti **Clean Architecture** yang solid:

```
Controller (HTTP) → Application (Service) → Domain (Repository Interface) → Infrastructure (Memory/Prisma)
```

- [GroupRepository](apps/backend/src/domain/repositories/group.repository.ts) sebagai interface abstrak — diimplementasikan oleh [MemoryGroupRepository](apps/backend/src/infrastructure/repositories/memory/memory-group.repository.ts) dan [PrismaGroupRepository](apps/backend/src/infrastructure/repositories/prisma/prisma-group.repository.ts).
- **Dual data source** (`memory` / `prisma`) memungkinkan development tanpa database — sangat produktif.
- NestJS module system digunakan dengan benar: `AuthModule`, `GroupsModule`, `InvoicesModule`, `MasterDataModule` masing-masing self-contained.

#### Database Schema
- [schema.prisma](apps/backend/prisma/schema.prisma) terstruktur baik: 17 model, 8 enum dengan relasi yang jelas.
- Index strategi sudah dipertimbangkan (composite indexes pada search document, lifecycle status, dll).
- Cascade delete dipasang dengan benar (Group → Timeline, Itinerary, Notes, dll).
- `onDelete: SetNull` untuk relasi optional (Group → Invoice, AuditLog) — sensible choice.

#### Frontend: Hook-Based Architecture
- React Query (TanStack) digunakan konsisten untuk server state management.
- Custom hooks terorganisir per domain: `use-groups-query`, `use-invoice-backend`, `use-auth-session-query`, dll.
- Lazy loading komponen berat (`LazyDashboardWorkspaceShell`, `LazyLoginScreen`) — baik untuk initial bundle size.

### ⚠️ Concerns

#### 1. God Files — Frontend
Beberapa file terlalu besar dan melanggar Single Responsibility Principle:

| File | Lines | Size |
|---|---:|---:|
| [group-detail-modals.tsx](apps/frontend/src/components/group-detail-modals.tsx) | **1,897** | 77 KB |
| [use-dashboard-group-records.ts](apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts) | — | **62 KB** |
| [invoice-export.ts](apps/frontend/src/pages/invoice-export.ts) | — | 47 KB |
| [frontend.smoke.test.ts](apps/frontend/src/smoke/frontend.smoke.test.ts) | — | 42 KB |
| [invoice-list-page.tsx](apps/frontend/src/pages/invoice-list-page.tsx) | — | 36 KB |
| [master-data-page.tsx](apps/frontend/src/pages/master-data-page.tsx) | — | 33 KB |
| [profile-page.tsx](apps/frontend/src/pages/profile-page.tsx) | — | 26 KB |
| [invoice-page-shared.ts](apps/frontend/src/pages/invoice-page-shared.ts) | — | 31 KB |

> [!WARNING]
> File `group-detail-modals.tsx` berisi **1,897 baris** dalam satu file. Sudah ada refactor parsial ke `group-detail-modals/` folder (8 modal terpisah), tapi file monolith masih ada dan belum dihapus. Ini bisa membingungkan — modal mana yang sebenarnya digunakan?

#### 2. `GroupsService` Constructor Smell
Di `GroupsService`, constructor melakukan runtime fallback ke repository baru jika injected repo invalid:
Ini defensif tapi menandakan DI container tidak fully trustworthy. Idealnya `RepositoriesModule` selalu menyediakan `GroupRepository` yang benar — jika injection gagal, itu harus error keras, bukan silent fallback.

#### 3. Dual Module/Store Legacy
Ada dua layer infrastruktur yang bersamaan:
- **Lama**: `groups.memory-store.ts` di `groups/infrastructure/`
- **Baru**: `memory-group.repository.ts` di `infrastructure/repositories/memory/`

Migrasi ke Repository Pattern belum tuntas — ada kode legacy besar yang berpotensi dead code.

---

## 2. Keamanan

### ✅ Strengths

#### Authentication
- **AuthGuard global** — semua route terproteksi default, hanya `@Public()` yang terbuka.
- **Dual auth transport**: HttpOnly cookie + Bearer token untuk flexibility.
- JWT dengan HS256 signing, configurable secret via `AUTH_SECRET`.
- Token lifetime: 12 jam standard, 14 hari untuk "remember me".
- Production safety guards: `auth.service.ts` menolak default secret, enforces minimum 32 chars.

#### CSRF Protection
- Origin-based CSRF protection untuk cookie-authenticated write requests (POST/PUT/PATCH/DELETE). Baik — tidak mengizinkan mutation tanpa Origin header.

#### Rate Limiting
- Login rate limiter kustom dengan lockout mechanism.
- Global throttling via `@nestjs/throttler` dengan AppThrottlerStorage (persistent via PostgreSQL).
- Configurable window, max attempts, dan lock duration via environment.

#### Security Headers
- Helmet dengan konfigurasi ketat: CSP disabled (SPA), X-Frame-Options: DENY, no referrer, dll.
- Custom `Permissions-Policy` header menonaktifkan camera/geolocation/microphone.
- `x-powered-by` header di-disable.
- `Cache-Control: no-store` pada auth endpoints.

#### Environment Validation
- Joi schema memvalidasi semua environment variables saat startup.
- Production-specific guards: memastikan `AUTH_SECRET`, `CORS_ORIGINS` wajib diisi, `AUTH_BOOTSTRAP_DEFAULT_USERS` harus false.

### ⚠️ Concerns

#### 1. Default Secret di Source Code
Meskipun dijaga oleh production check, secret hardcoded di source control tetap merupakan risk jika seseorang salah konfigurasi.

#### 2. bcrypt Sync Hash di Memory Mode
`hashAuthPassword` menggunakan synchronous bcrypt yang memblok event loop. Di startup ini acceptable, tapi pastikan ini tidak digunakan di hot path.

#### 3. ContentSecurityPolicy Disabled
Untuk SPA ini memang sulit, tapi sebaiknya tambahkan CSP minimal (script-src, style-src) di Nginx level.

#### 4. Nginx Tidak Punya Security Headers
`nginx.conf` hanya handle caching dan reverse proxy. Perlu ditambahkan:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)

---

## 3. Kualitas Kode

### ✅ Strengths

- **TypeScript strict mode** enabled di `tsconfig.base.json`.
- **Zod v4** digunakan untuk schema validation di frontend forms.
- **class-validator + class-transformer** di backend DTOs — proper NestJS patterns.
- ESLint + Prettier configured untuk frontend.
- Structured logging via Pino — production-ready log format.
- Error handling terpusat via `ApiExceptionFilter`.
- Swagger/OpenAPI documentation lengkap dengan decorator di setiap endpoint.

### ⚠️ Concerns

#### 1. `@typescript-eslint/no-explicit-any: "off"`
Di `eslint.config.mjs`, `any` diizinkan sepenuhnya. Ini membuka pintu untuk type-safety gaps.

#### 2. Frontend Type Module vs Backend CommonJS
- Frontend: `"type": "module"` ✅
- Backend: `"type": "commonjs"`
Ini valid tapi bisa membingungkan developer baru di monorepo.

#### 3. `ConfigService` Optional Injection
Di beberapa service, `ConfigService` di-inject sebagai optional. `ConfigModule.forRoot({ isGlobal: true })` seharusnya menjamin `ConfigService` selalu tersedia — optional inject menambah unnecessary null checks.

#### 4. Large Seed File
`seed.ts` berukuran **45 KB** — kemungkinan berisi banyak fixture data inline. Pertimbangkan memisahkan ke seed fixtures.

---

## 4. Testing

### ✅ Strengths

- **Multi-layer test strategy**: Unit → Smoke → API E2E → Integration (Prisma) → E2E (Playwright).
- **Vitest** sebagai test runner — modern dan cepat.
- Coverage thresholds enforced di CI:
  - Backend: 60% lines, 68% functions, 62% branches
  - Frontend: 38% lines, 36% functions, 31% branches
- Custom test utilities: `runCase`, `withEnv`, `withMockFetch`, `withMockWindow` — DRY test helpers.

### ⚠️ Concerns

#### 1. Frontend Coverage Rendah
Frontend coverage threshold hanya **35-38%** — ini sangat rendah untuk business-critical application.

| Metric | Backend | Frontend | Target Ideal |
|---|:---:|:---:|:---:|
| Lines | 60% | 38% | 70%+ |
| Functions | 68% | 36% | 60%+ |
| Branches | 62% | 31% | 55%+ |

#### 2. Coverage Threshold Mismatch
Threshold di `vitest.config.mts` (45/50/40) berbeda dari yang di `package.json` CLI args (38/36/31). Ini bisa menyebabkan confusion.

#### 3. Monolithic Smoke Test
Satu file `frontend.smoke.test.ts` (42 KB) — harus dipecah per modul/feature.

#### 4. Component Tests Belum Lengkap
Ada `vitest.component.config.mts` dan script `test:component`, tapi component tests hanya ada untuk `group-detail-modals/__tests__/`. Sebagian besar komponen belum punya test.

#### 5. `fileParallelism: false`
Di kedua Vitest configs, `fileParallelism: false`. Ini memastikan test isolation tapi memperlambat CI. Pertimbangkan enablekan parallelism dengan proper isolation.

---

## 5. DevOps & Deployment

### ✅ Strengths

#### Docker
- Multi-stage builds untuk backend dan frontend — proper image optimization.
- Production compose dengan `service_healthy` condition untuk PostgreSQL — no premature startup.
- PostgreSQL exposed hanya internal (via `expose:`, bukan `ports:`) — keamanan container.
- Named volume (`gtt_postgres_prod_data`) untuk data persistence.

#### CI Pipeline
- Type check → Unit tests → Smoke → Build → E2E → Coverage.
- Coverage artifacts di-upload ke GitHub dengan 30-day retention.
- E2E tests `continue-on-error: true` untuk PRs — pragmatic.

#### Dev Experience
- Port release scripts sebelum dev start (`predev` hook).
- Runtime config injection untuk frontend builds.
- Icon subset management (`check:icons`, `assets:icons`).
- Bundle analysis script (`analyze:bundle`).

### ⚠️ Concerns

#### 1. CI "Dinonaktifkan"
README menyebutkan: *"CI GitHub Actions saat ini dinonaktifkan — validasi dijalankan secara manual sebelum merge."*
Tanpa CI aktif, tidak ada gatekeeper otomatis terhadap regresi. Ini adalah **risiko tertinggi** untuk maintainability jangka panjang.

#### 2. Docker Image Size
Backend Dockerfile copy seluruh `node_modules` dari build stage, termasuk devDependencies. Perlu `npm ci --production` di runtime stage atau `.dockerignore` yang ketat.

#### 3. Log Files Committed?
Di `apps/backend/` terdapat beberapa log files (`dev.stderr.log`, dll). `.gitignore` sudah ada rule `*.log`, tapi kalau file-file ini sudah ter-track di Git, mereka tetap akan muncul.

#### 4. Tidak Ada Health Check pada Backend Container
Backend container tidak punya `healthcheck:` directive — jika crash, `restart: unless-stopped` akan restart tapi orchestrator tidak bisa monitor health.

---

## 6. Dokumentasi

### ✅ Strengths

Ini adalah **aspek terbaik** dari project. Dokumentasi sangat komprehensif:

- `README.md`: Full quick start, arsitektur, modul, scripts, deployment, security.
- `docs/` berisi 9 dokumen teknis covering frontend, backend, deployment, QA, release flow.
- `.env.example`: 208 baris dengan komentar detail per variable.
- `CONTRIBUTING.md`: Branch & PR flow.
- `DATABASE-STRUCTURE.md`, `DESIGN_SYSTEM.md`: Domain documentation.

### ⚠️ Minor Concerns

- Beberapa markdown files di root (`CRITICAL_FIXES_PLAN.md`, `REFACTOR-GROUP-DETAIL-MODALS-PLAN.md`, `PROJECT-REVIEW.md`) terlihat seperti work-in-progress documents.
- Bilingual documentation (Bahasa Indonesia + English) bisa membingungkan kontributor baru. Pertimbangkan konsistensi.

---

## 7. Performance

### ✅ Strengths

- Code splitting via esbuild (`--splitting`) dengan content-hashed chunks.
- Nginx caching strategy: immutable 1y untuk chunks/fonts, no-cache untuk entry points.
- Gzip enabled di Nginx.
- Lazy loading routes di React.
- PostgreSQL indexes teroptimasi untuk common query patterns.

### ⚠️ Concerns

#### 1. Frontend Bundle Concerns
- `group-detail-modals.tsx` (77 KB source) menghasilkan bundle chunk yang besar.
- `invoice-export.ts` (47 KB) — export logic sebaiknya lazy loaded.

#### 2. Memory Store Scalability
`groups.memory-store.ts` fine untuk development tapi jika accidentally deployed, tidak ada data persistence dan memory leaks possible.

#### 3. No Request Pagination Defaults
Check apakah semua list endpoints memiliki default pagination untuk menghindari N+1 query atau response yang terlalu besar.

---

## 8. Rekomendasi Prioritas

### 🔴 Prioritas Tinggi (Harus Segera)

| # | Item | Impact |
|---|---|---|
| 1 | **Aktifkan CI Pipeline** | Prevent regressions, enforce quality gates |
| 2 | **Bersihkan god file** `group-detail-modals.tsx` — migrasi tuntas ke folder `group-detail-modals/` lalu hapus monolith | Maintainability |
| 3 | **Tambah security headers di Nginx** (HSTS, X-Content-Type-Options, CSP dasar) | Security hardening |
| 4 | **Optimize Docker image** — prune devDependencies di runtime stage | Reduce attack surface + image size |

### 🟡 Prioritas Sedang

| # | Item | Impact |
|---|---|---|
| 5 | Naikkan frontend test coverage ke minimal 50% lines | Reliability |
| 6 | Pecah `use-dashboard-group-records.ts` (62 KB) menjadi hooks yang lebih kecil | DX |
| 7 | Pecah `frontend.smoke.test.ts` per modul | Test maintainability |
| 8 | Hapus dead code di `groups/infrastructure/` legacy store | Code hygiene |
| 9 | Tambah backend container healthcheck di `docker-compose.prod.yml` | Operational reliability |
| 10 | Hapus constructor fallback di `GroupsService` — fix DI configuration properly | Code quality |

---

## 9. Ringkasan Statistik

### Backend (`apps/backend/src/`)

| Metric | Value |
|---|---|
| Source directories | 16 |
| Key modules | Auth, Groups, Invoices, Master Data, Health, Throttling |
| Data sources | Memory + Prisma (PostgreSQL) |
| DB Models | 17 |
| DB Enums | 8 |
| Swagger docs | Yes (with full decorator coverage) |
| Test coverage threshold | 60% lines |

### Frontend (`apps/frontend/src/`)

| Metric | Value |
|---|---|
| Components | 18 files + 1 subdirectory |
| Pages | 26 files + 10 subdirectories |
| Custom hooks | 20 files |
| Shared modules | 17 files |
| Unit tests | 17 test files |
| CSS size | 33 KB (design tokens + global styles) |
| Test coverage threshold | 38% lines |
