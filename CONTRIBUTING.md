# Contributing

## Branch and Pull Request flow

To separate development-ready vs production-ready code:

1. `develop` is the integration branch (active development).
2. `master`/`main` is production-ready only.
3. Create feature branches from `develop` (for example `feature/<short-description>`).
4. Open Pull Request from feature branch into `develop`.
5. Promote to production by Pull Request from `develop` into `master` (or `main`).
6. Merge only through Pull Request review.

For now, verification is manual. Run the checks you need locally before opening or merging a Pull Request:

- `npm run qa`
- `npm run qa:full`
- `npm run verify`
- `npm run test:integration`
- `npm run test:e2e:frontend`

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
3. Import utilities dari `src/test/`:
   - `runCase(name, fn)` - wrapper untuk `it()`
   - `withMockFetch(fn)` - mock global fetch
   - `withMockWindow(fn)` - mock window object
4. Gunakan `describe()` untuk grouping, `expect()` untuk assertions
5. Test pure functions dan business logic, bukan React components (untuk sekarang)

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

Backend integration tests (`src/e2e/*.test.ts`) membutuhkan PostgreSQL:

```bash
# Start PostgreSQL
docker compose up -d postgres

# Run migrations
npm run db:deploy:backend

# Run integration tests
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
