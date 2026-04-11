# QA Workflow

Dokumen ini merangkum jalur QA yang bisa dipakai untuk memastikan aplikasi berjalan sesuai, dari pengecekan cepat lokal sampai regresi penuh sebelum merge/release.

## 1. QA Cepat Lokal

Jalankan dari root project:

```bash
npm run qa
```

Command ini menjalankan:

- `npm run verify`
  - type-check semua workspace
  - unit test frontend + backend
  - build frontend + backend
- `npm run test:smoke`
  - smoke test helper/domain frontend
- `npm run test:api`
  - backend API e2e pada mode `memory`

Kapan dipakai:

- sebelum commit
- setelah selesai perubahan fitur
- saat ingin memastikan flow utama tetap aman tanpa PostgreSQL lokal

## 2. QA Penuh

Jalankan dari root project:

```bash
npm run qa:full
```

Command ini menjalankan semua yang ada di `npm run qa`, lalu menambahkan:

- `npm run test:integration`
  - integration test backend dengan Prisma + PostgreSQL
- `npm run test:e2e:frontend`
  - Playwright e2e frontend terhadap build frontend dan backend

Kapan dipakai:

- sebelum buka PR besar
- sebelum merge ke `develop`, `main`, atau `master`
- saat ingin menjalankan seluruh pemeriksaan manual secara lokal

## 3. Prasyarat QA Penuh

Backend integration memerlukan PostgreSQL lokal. Siapkan:

```bash
docker compose up -d
npm run db:generate:backend
```

Pastikan `apps/backend/.env` mengarah ke database lokal. Contoh yang cocok dengan `docker-compose.yml` repo ini:

```env
PORT=3001
DATA_SOURCE=prisma
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6543/gtt_ops?schema=public"
AUTH_BOOTSTRAP_DEFAULT_USERS="true"
DEV_AUTH_SUPERADMIN_PASSWORD="DevSuperAdmin#2026"
DEV_AUTH_ADMIN_PASSWORD="DevAdmin#2026"
```

Jika schema belum siap, jalankan juga:

```bash
npm run db:migrate:backend
npm run db:seed:backend
```

## 4. Catatan Playwright

- Pada Windows, konfigurasi Playwright repo ini memakai channel `msedge`.
- Pada Linux atau mesin baru, browser Chromium perlu di-install terlebih dahulu.
- Jika mesin lokal belum punya browser Playwright yang dibutuhkan, jalankan:

```bash
npx playwright install
```

## 5. Rekomendasi Praktis

- Gunakan `npm run qa` untuk iterasi harian.
- Gunakan `npm run qa:full` sebelum PR atau release.
- Jika hanya layer tertentu yang ingin dicek, jalankan command granular:
  - `npm run test:smoke`
  - `npm run test:api`
  - `npm run test:integration`
  - `npm run test:e2e:frontend`
