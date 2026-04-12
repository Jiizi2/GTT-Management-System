# Deploy Bertahap ke VPS dengan Docker Compose

Dokumen ini menjelaskan jalur deploy yang aman dan bertahap untuk repo ini ke VPS.
Fokusnya adalah membuat stack production yang sederhana:

- `web`: container Nginx yang menyajikan frontend static build dan meneruskan `/api` ke backend
- `backend`: API NestJS production
- `postgres`: database PostgreSQL dengan volume persisten

Pendekatan ini sengaja memakai `same-origin deployment`:

- browser mengakses satu origin yang sama
- frontend dilayani dari `/`
- backend diakses lewat `/api`

Keuntungan utamanya:

- konfigurasi cookie auth lebih sederhana
- `GTT_API_BASE_URL` biasanya tidak perlu diisi
- CORS tetap eksplisit tetapi lebih mudah dikelola

## Catatan Jika VPS Sudah Memakai PostgreSQL di Port 5432

Kalau di VPS sudah ada service lain yang memakai host port `5432`, stack ini tetap aman
karena `postgres` di `docker-compose.prod.yml` tidak memakai `ports:` ke host.
Service database ini hanya tersedia di network internal Compose lewat hostname
`postgres:5432`.

Artinya:

- tidak bentrok dengan PostgreSQL host lain yang sudah bind ke `127.0.0.1:5432` atau `0.0.0.0:5432`
- backend container tetap bisa terhubung normal lewat `DATABASE_URL` internal
- database stack ini tidak bisa diakses langsung dari luar VPS, yang justru lebih aman untuk production

Konflik baru akan terjadi kalau nanti kamu sengaja menambahkan:

- `ports: - "5432:5432"` pada service `postgres`, atau
- mapping host port lain yang kebetulan juga sudah dipakai service lain

Kalau suatu saat kamu memang butuh akses database dari host VPS, gunakan host port lain,
misalnya `127.0.0.1:55432:5432`, bukan `5432:5432`.

## File yang Ditambahkan

- `docker-compose.prod.yml`
- `apps/backend/Dockerfile`
- `deploy/web/Dockerfile`
- `deploy/web/nginx.conf`
- `compose.production.example.env`
- `apps/backend/env.production.compose.example`

## Step 1: Siapkan File Env

Di VPS, siapkan dua file berbeda:

1. root env untuk Docker Compose
2. backend env untuk aplikasi NestJS

Copy contoh berikut:

```bash
cp compose.production.example.env .env
cp apps/backend/env.production.compose.example apps/backend/.env
```

Peran masing-masing:

- root `.env` dipakai Docker Compose untuk nilai `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, dan `WEB_PORT`
- `apps/backend/.env` dipakai backend untuk env runtime seperti `AUTH_SECRET`, `CORS_ORIGINS`, `TRUST_PROXY`, dan throttle settings

Catatan penting:

- `DATABASE_URL` production tidak perlu ditulis di `apps/backend/.env` untuk jalur Compose ini, karena `docker-compose.prod.yml` menginjeksi URL internal `postgres:5432`
- `AUTH_BOOTSTRAP_DEFAULT_USERS` harus tetap `false` di production
- `TRUST_PROXY=true` disarankan di jalur ini karena backend berada di belakang container Nginx
- `docker-compose.prod.yml` juga mengunci `NODE_ENV=production`, `DATA_SOURCE=prisma`, `AUTH_BOOTSTRAP_DEFAULT_USERS=false`, dan `TRUST_PROXY=true` agar nilai dev lokal tidak ikut terbawa

### Checklist Isi Env yang Wajib Kamu Review

Saat pertama deploy, fokus review nilai berikut saja.

Root `.env` untuk Docker Compose:

- `WEB_PORT`
  - Port host VPS yang dipakai container `web`
  - Aman dibiarkan `8080` untuk awal
  - Ganti hanya kalau `8080` sudah dipakai service lain di VPS
- `POSTGRES_USER`
  - Username DB internal untuk aplikasi ini
  - Contoh aman: `gtt_app`
- `POSTGRES_PASSWORD`
  - Password DB internal
  - Wajib ganti ke password kuat
- `POSTGRES_DB`
  - Nama database aplikasi
  - Default `gtt_ops` sudah oke

`apps/backend/.env` untuk backend:

- `AUTH_SECRET`
  - Wajib ganti
  - Gunakan string acak panjang, minimal 32 karakter
- `CORS_ORIGINS`
  - Wajib ganti
  - Isi origin final frontend secara penuh
  - Contoh domain: `https://app.example.com`
  - Contoh sementara saat test via IP: `http://123.123.123.123:8080`
- `TRUST_PROXY`
  - Biarkan `true` untuk jalur Compose ini
- `LOG_LEVEL`
  - `info` cocok untuk production awal
- `HTTP_LOG_SUCCESS`
  - `true` cocok saat awal deploy agar debugging lebih mudah

Yang biasanya tidak perlu kamu ubah dulu:

- `PORT`
- `DATA_SOURCE`
- semua env throttle default
- semua env retention default

Yang jangan diisi sembarangan:

- `AUTH_COOKIE_DOMAIN`
  - Kosongkan dulu kecuali kamu memang butuh cookie lintas subdomain seperti `.example.com`
- `DATABASE_URL`
  - Tidak perlu ditulis manual untuk jalur Compose ini
- `AUTH_BOOTSTRAP_DEFAULT_USERS`
  - Harus tetap `false`

## Step 2: Build Image

Jalankan dari root project:

```bash
docker compose -f docker-compose.prod.yml build
```

Yang terjadi:

- image `web` membangun frontend production lalu menyalinnya ke Nginx
- image `backend` meng-install dependency, build TypeScript, lalu menyiapkan runtime NestJS

## Step 3: Jalankan Migrasi Database

Sebelum seluruh stack dinaikkan, jalankan migrasi:

```bash
docker compose -f docker-compose.prod.yml run --rm backend npm run db:deploy --workspace backend
```

Kenapa langkah ini dipisah:

- supaya schema database sinkron lebih dulu
- jika migrasi gagal, kamu tahu masalahnya sebelum service production dijalankan penuh

Jangan pakai `db:migrate` di production. Gunakan `db:deploy`.

## Step 4: Naikkan Stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

Setelah itu:

- frontend tersedia di `http://SERVER_IP:WEB_PORT`
- backend hanya diakses internal oleh container `web`
- PostgreSQL hanya diakses internal oleh container `backend`

## Step 5: Verifikasi Awal

Cek service yang berjalan:

```bash
docker compose -f docker-compose.prod.yml ps
```

Lihat log:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web
```

Endpoint penting:

- `http://SERVER_IP:WEB_PORT/`
- `http://SERVER_IP:WEB_PORT/api/health`

## Step 6: Tambahkan Domain dan HTTPS

Untuk akses internet publik, ada dua pilihan aman:

1. taruh reverse proxy host-level di depan `WEB_PORT` yang sudah dibuka
2. nanti tambahkan layer proxy TLS terpisah di Docker Compose

Untuk tahap awal scaffold ini, stack production difokuskan dulu pada:

- build yang repeatable
- networking internal antar-container
- migrasi database
- pemisahan env yang jelas

Setelah domain siap, set:

- `CORS_ORIGINS` ke origin final, misalnya `https://app.example.com`
- `AUTH_COOKIE_DOMAIN` tetap kosong kecuali kamu memang butuh scope cookie lintas subdomain

## Step 7: Update Aplikasi

Saat ada rilis baru:

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm backend npm run db:deploy --workspace backend
docker compose -f docker-compose.prod.yml up -d
```

## Step 8: Operasional Harian

Hal yang perlu dijaga:

- jangan jalankan `docker compose down -v` di production kecuali memang sengaja menghapus volume database
- backup PostgreSQL secara berkala dengan `pg_dump`
- simpan secret production hanya di file env VPS, bukan di git
- pantau log container jika login, CORS, atau proxy bermasalah

## Catatan Khusus Repo Ini

- `docker-compose.yml` yang sudah ada tetap dipertahankan untuk kebutuhan PostgreSQL lokal/dev
- jalur production baru dipisahkan ke `docker-compose.prod.yml`
- frontend repo ini memang sudah cocok untuk same-origin `/api`, jadi pendekatan satu container web + proxy sengaja dipilih agar deployment lebih sederhana
