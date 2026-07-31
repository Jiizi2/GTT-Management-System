# Contributing

## Branch and Pull Request flow

To separate development-ready vs production-ready code:

1. `develop` is the integration branch (active development).
2. `master`/`main` is production-ready only.
3. Create feature branches from `develop` (for example `feature/<short-description>`).
4. Open Pull Request from feature branch into `develop`.
5. Promote to production by Pull Request from `develop` into `master` (or `main`).
6. Merge only through Pull Request review.

### Verification & CI/CD Status
GitHub Actions CI is currently removed from this repository. Therefore, validation must be executed manually before opening a Pull Request or performing a release merge.

Recommended verification checks to run locally:
* **Fast path**: `npm run qa` (type-check, lint, unit test, build, frontend smoke, dan backend API test mode memory)
* **Full path**: `npm run qa:full` (fast path + component test + Prisma integration pada database QA khusus + Playwright release suite)
* **Granular commands** for checking specific layers:
  * `npm run verify` (type-check, lint, unit tests, and build)
  * `npm run test:api` (API test in memory mode)
  * `npm run test:integration` (integration tests with a guarded local PostgreSQL test database)
  * `npm run test:e2e:frontend` (Playwright e2e tests against dev builds)

### GitHub Protection Settings
Since status checks are not automatically run via CI, any required status checks in GitHub branch protection/rulesets should be disabled in the repository settings to allow manual validation without blocking merges.

## Local push guard

This repository includes `.githooks/pre-push` to block direct pushes to protected branches (`develop`, `master`, and `main`).

Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

## Testing Guidelines

### Sebelum Commit

Jalankan test suite untuk memastikan tidak ada regression:

```bash
# Quick check - unit tests saja
npm run test:unit

# Full check - unit tests + coverage
npm run test:unit:coverage:check

# QA lengkap - includes type check, build, smoke tests
npm run qa
```

### Menulis Test Baru

**Backend** (NestJS + Vitest):

1. Buat file `*.test.ts` di folder yang sama dengan source file
2. Import utilities dari `src/test/`:
   - `runCase(name, fn)` - wrapper untuk `it()`
   - `withEnv(overrides, fn)` - isolate environment variables
   - `withDataSource(type, fn)` - switch DATA_SOURCE
3. Gunakan `describe()` untuk grouping, `expect()` untuk assertions
4. Mock external dependencies dengan Vitest `vi.mock()` atau manual mocks

**Frontend** (React + Vitest):

1. Unit tests: `src/unit/*.test.ts`
2. Smoke tests: `src/smoke/*.test.ts` (integration-level)
3. Component tests: `src/components/**/*.test.{ts,tsx}` (jsdom)
4. Import utilities dari `src/test/`:
   - `runCase(name, fn)` - wrapper untuk `it()`
   - `withMockFetch(fn)` - mock global fetch
   - `withMockWindow(fn)` - mock window object
5. Gunakan `describe()` untuk grouping, `expect()` untuk assertions
6. Gunakan Testing Library untuk interaction dan accessibility contract komponen React

### Coverage Requirements

- **Backend**: Minimal 60% lines, 68% functions, 62% branches
- **Frontend**: Minimal 35% lines, 35% functions, 30% branches

Cek coverage dengan:

```bash
npm run test:unit:coverage
```

### Test Naming Convention

- Gunakan nama yang deskriptif dalam Bahasa Inggris
- Format: `should <expected behavior>` atau `<scenario> <expected result>`
- Contoh: `should create invoice with auto-generated number`, `invalid email throws error`

### When to Write Tests

**Wajib**:
- Bug fixes (tulis test yang reproduce bug dulu)
- Fitur baru (minimal happy path + edge cases)
- Refactoring (pastikan test lama masih pass)

**Optional tapi recommended**:
- Critical business logic (invoice calculations, invoice state transitions)
- Authentication/authorization flows
- Database queries yang kompleks

### Integration Tests

Backend integration tests (`src/e2e/*.test.ts`) membutuhkan database PostgreSQL lokal khusus QA. Runner menolak host remote dan nama database yang tidak memuat `test` atau `qa`.

```bash
# Start PostgreSQL dan buat database khusus satu kali
docker compose up -d postgres
docker compose exec postgres createdb -U postgres gtt_ops_test
```

Tambahkan ke `apps/backend/.env`:

```env
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6543/gtt_ops_test?schema=public"
```

Runner menerapkan migration ke database tersebut sebelum menjalankan Vitest:

```bash
npm run test:integration
```

### E2E Tests

Playwright E2E tests (`apps/frontend/e2e/*.spec.ts`) membutuhkan build:

```bash
# Build frontend + backend
npm run build

# Run E2E tests
npm run test:e2e:frontend
```

## Frontend: di mana kode baru ditaruh

Jawaban singkat: **`src/<domain>/`**.

`src/pages/` saat ini punya dua bentuk untuk hal yang sama — 18 file datar
(`profile-page.tsx`) dan 11 folder modul (`group-detail/{components,hooks}`).
Tanpa aturan, kontributor menebak, dan bentuk ketiga muncul.

Aturannya:

- **Domain fitur baru** → `src/<domain>/`, dengan struktur internal secukupnya
  (`components/`, `hooks/`, `helpers/`). Contoh yang sudah ada: `agent/`.
- **Logika yang dipakai 2+ domain** → `src/shared/`. Kalau dua domain
  membutuhkan hal yang sama, itu milik `shared/`, bukan disalin atau dijangkau
  lintas folder.
- **`src/pages/` dibekukan** — tidak menerima file baru. Yang sudah ada
  dibiarkan sampai tersentuh karena alasan lain; jangan migrasi massal.

Kenapa ini penting, dengan contoh nyata dari repo ini:

- `pages/new-group/helpers/new-group-screen-helpers.ts` sempat menjadi
  satu-satunya implementasi aturan bisnis (soft warning tanggal agreement),
  tersembunyi di folder yang layarnya sudah dihapus. Tidak ada UI yang
  memanggilnya selama berbulan-bulan. Sekarang ada di
  `shared/agreement-date-validation.ts`.
- Di branch `feature/finance-module`, modul `finance/` menjangkau ke dalam
  `pages/invoice/helpers/`. Begitu batas kepemilikan kabur, rumus profit
  ditulis ulang di frontend alih-alih dipakai bersama — dan hasilnya berbeda
  dari perhitungan backend.

Catatan: `agent/` mengimpor layar dari `pages/` secara sengaja — Portal Agent
merender layar Ops yang sama dengan data ber-scope agent. Itu reuse yang
direncanakan, bukan pelanggaran batas.
