# QA Workflow

Dokumen ini mendefinisikan gate QA manual untuk GTT Management System. GitHub Actions belum menjadi bagian dari delivery saat ini, sehingga hasil command di dokumen ini harus dicatat oleh developer atau reviewer sebelum merge dan release.

## 1. Prinsip Jalur QA

- Test API dan integration dijalankan oleh Vitest langsung dari TypeScript, bukan dari output CommonJS hasil build.
- Test database hanya boleh menggunakan `TEST_DATABASE_URL` yang menunjuk ke loopback lokal.
- Nama database integration wajib mengandung token `test` atau `qa`.
- Database development biasa dan database production tidak boleh dipakai untuk integration test.
- Diagnostic Playwright bersifat ad-hoc dan tidak menjadi bagian dari release suite.
- `qa:quick` tidak membutuhkan PostgreSQL; `qa:full` membutuhkan database QA lokal dan browser Playwright.

## 2. QA Cepat

Jalankan dari root project:

```bash
npm run qa
```

`qa` adalah alias `qa:quick` dan menjalankan urutan berikut:

1. `npm run verify`
   - type-check backend dan frontend;
   - lint frontend;
   - unit test backend dan frontend;
   - build backend dan frontend.
2. `npm run test:smoke`
   - smoke test frontend.
3. `npm run test:api`
   - API E2E backend dalam mode memory melalui Vitest.

Gunakan jalur ini sebelum commit, sesudah perubahan fitur, dan untuk perubahan yang tidak bergantung pada perilaku PostgreSQL.

## 3. QA Penuh

Jalankan dari root project:

```bash
npm run qa:full
```

Urutannya adalah:

1. seluruh `qa:quick`;
2. component test frontend;
3. seluruh integration test Prisma;
4. Playwright release suite `app.e2e.spec.ts`.

Build dari `qa:quick` digunakan kembali oleh Playwright sehingga `qa:full` tidak melakukan build kedua. Jalur ini wajib sebelum release manual dan direkomendasikan sebelum merge perubahan database, autentikasi, invoice, group, atau kontrak API.

## 4. Menyiapkan Database QA

Naikkan PostgreSQL lokal:

```bash
docker compose up -d postgres
```

Buat database khusus test satu kali:

```bash
docker compose exec postgres createdb -U postgres gtt_ops_test
```

Jika command melaporkan database sudah ada, tidak perlu membuat ulang. Tambahkan URL berikut ke `apps/backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6543/gtt_ops?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6543/gtt_ops_test?schema=public"
```

Runner `apps/backend/scripts/run-prisma-integration.mjs` akan:

1. menolak `TEST_DATABASE_URL` kosong;
2. menolak protocol selain PostgreSQL;
3. menolak host selain `127.0.0.1`, `localhost`, atau `::1`;
4. menolak nama database tanpa token `test` atau `qa`;
5. menyalin URL tervalidasi ke `DATABASE_URL` hanya untuk child process;
6. menghasilkan Prisma Client dari schema repo;
7. menerapkan migration repo ke database QA;
8. menjalankan tiga suite Prisma melalui Vitest.

Integration suite bersifat destructive terhadap database QA. Jangan menyimpan data manual penting di `gtt_ops_test`.

## 5. Command Granular

| Command | Database | Cakupan |
|---|---|---|
| `npm run check` | Tidak | TypeScript seluruh workspace |
| `npm run lint:frontend` | Tidak | ESLint frontend |
| `npm run test:unit` | Tidak | Unit backend dan frontend |
| `npm run test:component:frontend` | Tidak | Component test React/jsdom |
| `npm run test:smoke` | Tidak | Smoke test frontend |
| `npm run test:api` | Tidak | API E2E backend mode memory |
| `npm run test:integration` | Ya, khusus QA | Integration Prisma lengkap |
| `npm run test:e2e:frontend` | Tidak | Build lalu Playwright release suite |
| `npm run test:e2e:frontend:run` | Tidak | Playwright release suite dengan build yang sudah ada |
| `npm run test:e2e:diagnostics --workspace frontend` | Tidak | Diagnostic ad-hoc, bukan gate |
| `npm run test:unit:coverage:check` | Tidak | Unit test dan threshold coverage |

## 6. Playwright

- Windows menggunakan channel `msedge`.
- Linux dan mesin baru membutuhkan Chromium Playwright.
- Install browser jika belum tersedia:

```bash
npx playwright install
```

Normal release suite hanya menjalankan `apps/frontend/e2e/app.e2e.spec.ts`. File `diagnostics.spec.ts` harus dijalankan secara eksplisit dan outputnya tidak digunakan sebagai bukti kelulusan release.

## 7. Interpretasi Kegagalan

- Gagal di `check` atau `build`: hentikan merge; perbaiki kontrak TypeScript/build.
- Gagal di unit/component/smoke: hentikan merge; tambahkan atau perbaiki regression test.
- Gagal di `test:api`: masalah berada pada flow HTTP mode memory atau bootstrap aplikasi.
- Runner integration menolak URL: perbaiki `TEST_DATABASE_URL`; jangan menonaktifkan guard.
- Migration integration gagal: buat ulang database QA jika history berasal dari branch lain, lalu ulangi.
- Playwright gagal tetapi test layer lain lulus: simpan trace/screenshot kegagalan dan periksa flow browser sebelum release.

## 8. Checklist Release Manual

- [ ] Worktree hanya berisi perubahan yang memang akan dirilis.
- [ ] `npm run qa:full` selesai dengan exit code 0.
- [ ] Perubahan schema memiliki migration dan telah diuji pada database QA baru.
- [ ] Tidak ada penggunaan `DATABASE_URL` production pada command lokal.
- [ ] Reviewer mencatat tanggal, commit SHA, OS, Node version, dan hasil QA.
- [ ] Untuk perubahan data sensitif, tersedia backup dan rollback procedure yang telah ditinjau.
